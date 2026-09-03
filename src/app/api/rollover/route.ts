import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSnapshot } from "@/lib/finance/snapshot";
import { currentMonth, monthStart, shiftMonth } from "@/lib/finance/calculations";
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

/**
 * Idempotent month-rollover: if the previous (just-completed) month has no
 * snapshot yet, build it from the live tables and archive it. Safe to call on
 * every app load — it no-ops once the snapshot exists. Can also be triggered by
 * a scheduled job (e.g. Supabase pg_cron) on the 1st of each month.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The completed month to archive = the month before the current one.
  const completedMonth = shiftMonth(currentMonth(), -1);
  const completedMonthStart = monthStart(completedMonth);

  // Skip if already archived.
  const { data: existing } = await supabase
    .from("monthly_snapshots")
    .select("id")
    .eq("user_id", user.id)
    .eq("month", completedMonthStart)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ archived: false, month: completedMonth });
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
  ] = await Promise.all([
    supabase.from("flow_accounts").select("*"),
    supabase.from("account_history").select("*"),
    supabase.from("income_items").select("*"),
    supabase.from("income_history").select("*"),
    supabase.from("subscriptions").select("*"),
    supabase.from("subscription_history").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("expenses").select("*"),
  ]);

  const payload = buildSnapshot(
    {
      accounts: (accounts ?? []) as FlowAccount[],
      accountHistory: (accountHistory ?? []) as AccountHistory[],
      incomeItems: (incomeItems ?? []) as IncomeItem[],
      incomeHistory: (incomeHistory ?? []) as IncomeHistory[],
      subscriptions: (subscriptions ?? []) as Subscription[],
      subscriptionHistory: (subscriptionHistory ?? []) as SubscriptionHistory[],
      budgets: (budgets ?? []) as Budget[],
      expenses: (expenses ?? []) as Expense[],
    },
    completedMonth
  );

  const { error } = await supabase.from("monthly_snapshots").insert({
    user_id: user.id,
    month: completedMonthStart,
    accounts: payload.accounts,
    income: payload.income,
    payments: payload.payments,
    budgets: payload.budgets,
    totals: payload.totals,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ archived: true, month: completedMonth });
}
