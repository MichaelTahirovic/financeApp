import type { SupabaseClient, User } from "@supabase/supabase-js";
import { currentMonth, monthStart, shiftMonth } from "@/lib/finance/calculations";
import { applyMonthRollover, type RolloverSummary } from "@/lib/finance/rollover";
import type { SnapshotInput } from "@/lib/finance/snapshot";
import type {
  AccountHistory,
  Budget,
  Expense,
  FlowAccount,
  IncomeHistory,
  IncomeItem,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";

export interface ServerRolloverResponse {
  archived: boolean;
  month: string;
  monthsProcessed: string[];
  summaries: RolloverSummary[];
}

/**
 * Ensures all completed months up through `shiftMonth(currentMonth(), -1)` have
 * been rolled over into `account_history`, `income_history`, `subscription_history`,
 * `monthly_snapshots`, and live tables (annual subscription accruals, non-recurring
 * item resets, and percentage budget recalculations).
 *
 * Uses `user.user_metadata.last_rollover_month` as a fast check so normal page
 * loads after rollover has already occurred for the current month require 0
 * extra database queries.
 */
export async function ensureMonthlyRollover(
  supabase: SupabaseClient,
  user: User,
  options: { force?: boolean; targetCompletedMonth?: string } = {}
): Promise<ServerRolloverResponse> {
  const now = currentMonth();
  const completedMonth = options.targetCompletedMonth ?? shiftMonth(now, -1);
  const lastRollover = (user.user_metadata?.last_rollover_month as string | undefined) ?? null;

  if (!options.force && lastRollover && lastRollover >= completedMonth) {
    return {
      archived: false,
      month: completedMonth,
      monthsProcessed: [],
      summaries: [],
    };
  }

  const [
    { data: accounts },
    { data: accountHistory },
    { data: incomeItems },
    { data: incomeHistory },
    { data: subscriptions },
    { data: subscriptionHistory },
    { data: budgets },
    { data: expenses },
    snapshotsRes,
  ] = await Promise.all([
    supabase.from("flow_accounts").select("*"),
    supabase.from("account_history").select("*"),
    supabase.from("income_items").select("*"),
    supabase.from("income_history").select("*"),
    supabase.from("subscriptions").select("*"),
    supabase.from("subscription_history").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("monthly_snapshots").select("*").eq("user_id", user.id),
  ]);

  let state: SnapshotInput = {
    accounts: (accounts ?? []) as FlowAccount[],
    accountHistory: (accountHistory ?? []) as AccountHistory[],
    incomeItems: (incomeItems ?? []) as IncomeItem[],
    incomeHistory: (incomeHistory ?? []) as IncomeHistory[],
    subscriptions: (subscriptions ?? []) as Subscription[],
    subscriptionHistory: (subscriptionHistory ?? []) as SubscriptionHistory[],
    budgets: (budgets ?? []) as Budget[],
    expenses: (expenses ?? []) as Expense[],
  };

  const existingSnapshots = new Map<
    string,
    {
      accounts?: { id: string; amount?: number; monthlyAmount?: number }[];
      income?: { id: string; amount?: number }[];
      payments?: { id: string; amount?: number }[];
    }
  >();
  if (snapshotsRes.data) {
    for (const row of snapshotsRes.data) {
      const m = String(row.month ?? "").slice(0, 7);
      if (m) existingSnapshots.set(m, row);
    }
  }

  // Determine the sequence of completed months to roll over (oldest -> newest).
  let monthsToProcess: string[] = [];
  if (options.targetCompletedMonth) {
    monthsToProcess = [options.targetCompletedMonth];
  } else if (lastRollover && lastRollover < completedMonth) {
    let cursor = shiftMonth(lastRollover, 1);
    let guard = 0;
    while (cursor <= completedMonth && guard < 12) {
      monthsToProcess.push(cursor);
      cursor = shiftMonth(cursor, 1);
      guard++;
    }
  } else {
    // First time running with full history rollover: find earliest month <= completedMonth
    // across created_at timestamps and any existing snapshots (capped at 12 months back).
    const minAllowed = shiftMonth(completedMonth, -11);
    const candidateMonths: string[] = [
      ...state.accounts.map((a) => a.created_at?.slice(0, 7)).filter(Boolean),
      ...state.incomeItems.map((i) => i.created_at?.slice(0, 7)).filter(Boolean),
      ...state.subscriptions.map((s) => s.created_at?.slice(0, 7)).filter(Boolean),
      ...existingSnapshots.keys(),
    ].filter((m) => m <= completedMonth);

    if (candidateMonths.length > 0) {
      candidateMonths.sort();
      let cursor = candidateMonths[0] < minAllowed ? minAllowed : candidateMonths[0];
      let guard = 0;
      while (cursor <= completedMonth && guard < 12) {
        monthsToProcess.push(cursor);
        cursor = shiftMonth(cursor, 1);
        guard++;
      }
    } else {
      monthsToProcess = [completedMonth];
    }
  }

  const summaries: RolloverSummary[] = [];
  let didArchiveAnything = false;

  for (const m of monthsToProcess) {
    const existingSnap = existingSnapshots.get(m) ?? null;
    const result = applyMonthRollover(state, m, {
      respectCreatedAt: !options.force,
      // If a snapshot already existed for `m` from an earlier run, backfill history
      // without double-applying annual accruals; otherwise apply full rollover.
      advanceLiveBalances: !existingSnap || Boolean(options.force),
      existingSnapshot: existingSnap,
    });

    if (result.newAccountHistory.length > 0) {
      didArchiveAnything = true;
      await supabase.from("account_history").upsert(
        result.newAccountHistory.map((h) => ({
          user_id: user.id,
          account_id: h.account_id,
          month: h.month,
          amount: h.amount,
        })),
        { onConflict: "account_id,month", ignoreDuplicates: true }
      );
    }

    for (const acc of result.updatedAccounts) {
      didArchiveAnything = true;
      await supabase
        .from("flow_accounts")
        .update({ amount: acc.amount })
        .eq("id", acc.id)
        .eq("user_id", user.id);
    }

    if (result.newIncomeHistory.length > 0) {
      didArchiveAnything = true;
      await supabase.from("income_history").upsert(
        result.newIncomeHistory.map((h) => ({
          user_id: user.id,
          income_id: h.income_id,
          month: h.month,
          amount: h.amount,
        })),
        { onConflict: "income_id,month", ignoreDuplicates: true }
      );
    }

    for (const item of result.updatedIncomeItems) {
      didArchiveAnything = true;
      await supabase
        .from("income_items")
        .update({ amount: item.amount })
        .eq("id", item.id)
        .eq("user_id", user.id);
    }

    if (result.newSubscriptionHistory.length > 0) {
      didArchiveAnything = true;
      await supabase.from("subscription_history").upsert(
        result.newSubscriptionHistory.map((h) => ({
          user_id: user.id,
          subscription_id: h.subscription_id,
          month: h.month,
          amount: h.amount,
        })),
        { onConflict: "subscription_id,month", ignoreDuplicates: true }
      );
    }

    for (const sub of result.updatedSubscriptions) {
      didArchiveAnything = true;
      await supabase
        .from("subscriptions")
        .update({ amount: sub.amount })
        .eq("id", sub.id)
        .eq("user_id", user.id);
    }

    for (const b of result.updatedBudgets) {
      didArchiveAnything = true;
      await supabase
        .from("budgets")
        .update({ monthly_limit: b.monthly_limit })
        .eq("id", b.id)
        .eq("user_id", user.id);
    }

    // Best-effort archive into monthly_snapshots if schema_v9 is applied.
    await supabase.from("monthly_snapshots").upsert(
      {
        user_id: user.id,
        month: monthStart(m),
        accounts: result.snapshot.accounts,
        income: result.snapshot.income,
        payments: result.snapshot.payments,
        budgets: result.snapshot.budgets,
        totals: result.snapshot.totals,
      },
      { onConflict: "user_id,month" }
    );

    state = result.nextState;
    summaries.push(result.summary);
  }

  // Record the latest completed month rolled over in user_metadata so future
  // page loads in the same month skip redundant checks.
  try {
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        last_rollover_month: completedMonth,
      },
    });
  } catch {
    // Ignore metadata update errors in read-only contexts.
  }

  return {
    archived: didArchiveAnything,
    month: completedMonth,
    monthsProcessed: monthsToProcess,
    summaries,
  };
}

