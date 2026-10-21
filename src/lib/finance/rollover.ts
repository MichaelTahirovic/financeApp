import { annualAccrual, monthStart, shiftMonth } from "@/lib/finance/calculations";
import { buildSnapshot, type SnapshotInput } from "@/lib/finance/snapshot";
import type {
  AccountHistory,
  Budget,
  FlowAccount,
  IncomeHistory,
  IncomeItem,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";

export interface RolloverSummary {
  completedMonth: string; // YYYY-MM
  nextMonth: string; // YYYY-MM
  accountsArchived: { name: string; kind: "receivable" | "payable"; amount: number }[];
  annualPayablesAccrued: { name: string; accrued: number; previousAmount: number; newAmount: number }[];
  incomeArchived: { name: string; amount: number; recurring: boolean }[];
  nonRecurringIncomeReset: { name: string; previousAmount: number }[];
  paymentsArchived: { name: string; amount: number; recurring: boolean }[];
  nonRecurringPaymentsReset: { name: string; previousAmount: number }[];
  budgetsRecalculated: {
    name: string;
    limitPercent: number;
    previousLimit: number;
    newLimit: number;
  }[];
}

export interface RolloverResult {
  nextState: SnapshotInput;
  newAccountHistory: AccountHistory[];
  updatedAccounts: FlowAccount[];
  newIncomeHistory: IncomeHistory[];
  updatedIncomeItems: IncomeItem[];
  newSubscriptionHistory: SubscriptionHistory[];
  updatedSubscriptions: Subscription[];
  updatedBudgets: Budget[];
  snapshot: ReturnType<typeof buildSnapshot>;
  summary: RolloverSummary;
}

export interface RolloverOptions {
  /**
   * When true, only accounts/items whose created_at month is <= completedMonth
   * are archived for that month. Defaults to false (archive all existing items).
   */
  respectCreatedAt?: boolean;
  /**
   * When false, skips mutating live tables (annual accrual, non-recurring reset,
   * budget recalculation) and only backfills missing history rows.
   */
  advanceLiveBalances?: boolean;
  /**
   * Optional archived snapshot from `monthly_snapshots` to source historical
   * amounts from when backfilling a month that was previously snapshotted.
   */
  existingSnapshot?: {
    accounts?: { id: string; amount?: number; monthlyAmount?: number }[];
    income?: { id: string; amount?: number }[];
    payments?: { id: string; amount?: number }[];
  } | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pure monthly rollover engine used by both the live server rollover and the
 * interactive Sandbox simulator.
 */
export function applyMonthRollover(
  data: SnapshotInput,
  completedMonth: string,
  options: RolloverOptions = {}
): RolloverResult {
  const {
    respectCreatedAt = false,
    advanceLiveBalances = true,
    existingSnapshot = null,
  } = options;

  const nextMonth = shiftMonth(completedMonth, 1);
  const completedMonthDate = monthStart(completedMonth);
  const nowIso = new Date().toISOString();

  const snapAccountAmount = new Map<string, number>();
  for (const a of existingSnapshot?.accounts ?? []) {
    const val = a.monthlyAmount ?? a.amount;
    if (a.id && val !== undefined) snapAccountAmount.set(a.id, Number(val));
  }

  const snapIncomeAmount = new Map<string, number>();
  for (const i of existingSnapshot?.income ?? []) {
    if (i.id && i.amount !== undefined) snapIncomeAmount.set(i.id, Number(i.amount));
  }

  const snapPaymentAmount = new Map<string, number>();
  for (const p of existingSnapshot?.payments ?? []) {
    if (p.id && p.amount !== undefined) snapPaymentAmount.set(p.id, Number(p.amount));
  }

  const newAccountHistory: AccountHistory[] = [];
  const updatedAccounts: FlowAccount[] = [];
  const accountsArchived: RolloverSummary["accountsArchived"] = [];
  const annualPayablesAccrued: RolloverSummary["annualPayablesAccrued"] = [];

  const nextAccounts = data.accounts.map((acc) => {
    const existedInMonth =
      !respectCreatedAt ||
      !acc.created_at ||
      acc.created_at.slice(0, 7) <= completedMonth ||
      snapAccountAmount.has(acc.id);

    const hasHistory = data.accountHistory.some(
      (h) => h.account_id === acc.id && h.month.slice(0, 7) === completedMonth
    );

    const closingAmount = snapAccountAmount.get(acc.id) ?? round2(Number(acc.amount) || 0);

    if (existedInMonth && !hasHistory) {
      newAccountHistory.push({
        id: `ah-${acc.id}-${completedMonth}`,
        user_id: acc.user_id,
        account_id: acc.id,
        month: completedMonthDate,
        amount: closingAmount,
        created_at: nowIso,
      });
      accountsArchived.push({
        name: acc.name,
        kind: acc.kind,
        amount: closingAmount,
      });
    }

    if (
      advanceLiveBalances &&
      existedInMonth &&
      acc.kind === "payable" &&
      acc.is_annual_subscription &&
      acc.annual_amount
    ) {
      const accrual = round2(annualAccrual(acc));
      if (accrual !== 0) {
        const prev = round2(Number(acc.amount) || 0);
        const nextAmt = round2(prev + accrual);
        const updated: FlowAccount = { ...acc, amount: nextAmt };
        updatedAccounts.push(updated);
        annualPayablesAccrued.push({
          name: acc.name,
          accrued: accrual,
          previousAmount: prev,
          newAmount: nextAmt,
        });
        return updated;
      }
    }

    return acc;
  });

  const nextAccountHistory = [...newAccountHistory, ...data.accountHistory];

  // ---------- Income ----------
  const newIncomeHistory: IncomeHistory[] = [];
  const updatedIncomeItems: IncomeItem[] = [];
  const incomeArchived: RolloverSummary["incomeArchived"] = [];
  const nonRecurringIncomeReset: RolloverSummary["nonRecurringIncomeReset"] = [];

  const nextIncomeItems = data.incomeItems.map((item) => {
    const existedInMonth =
      !respectCreatedAt ||
      !item.created_at ||
      item.created_at.slice(0, 7) <= completedMonth ||
      snapIncomeAmount.has(item.id);

    const hasHistory = data.incomeHistory.some(
      (h) => h.income_id === item.id && h.month.slice(0, 7) === completedMonth
    );

    const closingAmount = snapIncomeAmount.get(item.id) ?? round2(Number(item.amount) || 0);

    if (existedInMonth && !hasHistory) {
      newIncomeHistory.push({
        id: `ih-${item.id}-${completedMonth}`,
        user_id: item.user_id,
        income_id: item.id,
        month: completedMonthDate,
        amount: closingAmount,
        created_at: nowIso,
      });
      incomeArchived.push({
        name: item.name,
        amount: closingAmount,
        recurring: item.is_recurring,
      });
    }

    if (advanceLiveBalances && existedInMonth && !item.is_recurring && Number(item.amount) !== 0) {
      const prev = round2(Number(item.amount) || 0);
      const updated: IncomeItem = { ...item, amount: 0 };
      updatedIncomeItems.push(updated);
      nonRecurringIncomeReset.push({ name: item.name, previousAmount: prev });
      return updated;
    }

    return item;
  });

  const nextIncomeHistory = [...newIncomeHistory, ...data.incomeHistory];

  // ---------- Subscriptions (Payments) ----------
  const newSubscriptionHistory: SubscriptionHistory[] = [];
  const updatedSubscriptions: Subscription[] = [];
  const paymentsArchived: RolloverSummary["paymentsArchived"] = [];
  const nonRecurringPaymentsReset: RolloverSummary["nonRecurringPaymentsReset"] = [];

  const nextSubscriptions = data.subscriptions.map((sub) => {
    const existedInMonth =
      !respectCreatedAt ||
      !sub.created_at ||
      sub.created_at.slice(0, 7) <= completedMonth ||
      snapPaymentAmount.has(sub.id);

    const hasHistory = data.subscriptionHistory.some(
      (h) => h.subscription_id === sub.id && h.month.slice(0, 7) === completedMonth
    );

    const closingAmount = snapPaymentAmount.get(sub.id) ?? round2(Number(sub.amount) || 0);

    if (existedInMonth && !hasHistory) {
      newSubscriptionHistory.push({
        id: `sh-${sub.id}-${completedMonth}`,
        user_id: sub.user_id,
        subscription_id: sub.id,
        month: completedMonthDate,
        amount: closingAmount,
        created_at: nowIso,
      });
      paymentsArchived.push({
        name: sub.name,
        amount: closingAmount,
        recurring: sub.is_recurring,
      });
    }

    if (advanceLiveBalances && existedInMonth && !sub.is_recurring && Number(sub.amount) !== 0) {
      const prev = round2(Number(sub.amount) || 0);
      const updated: Subscription = { ...sub, amount: 0 };
      updatedSubscriptions.push(updated);
      nonRecurringPaymentsReset.push({ name: sub.name, previousAmount: prev });
      return updated;
    }

    return sub;
  });

  const nextSubscriptionHistory = [...newSubscriptionHistory, ...data.subscriptionHistory];

  // ---------- Snapshot for completedMonth ----------
  const snapshot = buildSnapshot(
    {
      accounts: data.accounts,
      accountHistory: nextAccountHistory,
      incomeItems: data.incomeItems,
      incomeHistory: nextIncomeHistory,
      subscriptions: data.subscriptions,
      subscriptionHistory: nextSubscriptionHistory,
      budgets: data.budgets,
      expenses: data.expenses,
    },
    completedMonth
  );

  // ---------- Budgets (re-resolve percentage limits against new month's cash flow) ----------
  const updatedBudgets: Budget[] = [];
  const budgetsRecalculated: RolloverSummary["budgetsRecalculated"] = [];

  const newIncomeTotal = nextIncomeItems
    .filter((i) => !i.hidden)
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const newPaymentTotal = nextSubscriptions
    .filter((s) => !s.hidden)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const newAvailableCashFlow = newIncomeTotal - newPaymentTotal;

  const nextBudgets = data.budgets.map((b) => {
    if (advanceLiveBalances && b.limit_percent != null) {
      const pct = Number(b.limit_percent);
      const newLimit = round2(newAvailableCashFlow * (pct / 100));
      const prevLimit = round2(Number(b.monthly_limit));
      if (newLimit !== prevLimit) {
        const updated: Budget = { ...b, monthly_limit: newLimit };
        updatedBudgets.push(updated);
        budgetsRecalculated.push({
          name: b.name,
          limitPercent: pct,
          previousLimit: prevLimit,
          newLimit,
        });
        return updated;
      }
    }
    return b;
  });

  return {
    nextState: {
      accounts: nextAccounts,
      accountHistory: nextAccountHistory,
      incomeItems: nextIncomeItems,
      incomeHistory: nextIncomeHistory,
      subscriptions: nextSubscriptions,
      subscriptionHistory: nextSubscriptionHistory,
      budgets: nextBudgets,
      expenses: data.expenses,
    },
    newAccountHistory,
    updatedAccounts,
    newIncomeHistory,
    updatedIncomeItems,
    newSubscriptionHistory,
    updatedSubscriptions,
    updatedBudgets,
    snapshot,
    summary: {
      completedMonth,
      nextMonth,
      accountsArchived,
      annualPayablesAccrued,
      incomeArchived,
      nonRecurringIncomeReset,
      paymentsArchived,
      nonRecurringPaymentsReset,
      budgetsRecalculated,
    },
  };
}

