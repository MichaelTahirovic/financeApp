import {
  budgetSpend,
  effectiveMonthlyAmount,
  monthlyRevenue,
  monthlySpend,
  netWorth,
} from "@/lib/finance/calculations";
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

export interface SnapshotInput {
  accounts: FlowAccount[];
  accountHistory: AccountHistory[];
  incomeItems: IncomeItem[];
  incomeHistory: IncomeHistory[];
  subscriptions: Subscription[];
  subscriptionHistory: SubscriptionHistory[];
  budgets: Budget[];
  expenses: Expense[];
}

/**
 * Build the closing snapshot for a completed month. Live tables are not reset;
 * this just captures the month's end state:
 * - accounts carry forward at their effective monthly amounts
 * - income/payments record the month's amount (history override, else current)
 * - budgets record spend vs. limit, with percentage budgets re-resolved against
 *   the month's available cash flow
 */
export function buildSnapshot(data: SnapshotInput, month: string) {
  const accountRows = data.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    amount: Number(a.amount),
    monthlyAmount: effectiveMonthlyAmount(a),
    isAnnual: a.is_annual_subscription,
    annualAmount: a.annual_amount,
    hidden: a.hidden,
  }));

  const incomeRows = data.incomeItems.map((i) => {
    const h = data.incomeHistory.find(
      (x) => x.income_id === i.id && x.month.slice(0, 7) === month
    );
    return {
      id: i.id,
      name: i.name,
      amount: h ? Number(h.amount) : Number(i.amount),
      recurring: i.is_recurring,
      hidden: i.hidden,
    };
  });

  const paymentRows = data.subscriptions.map((s) => {
    const h = data.subscriptionHistory.find(
      (x) => x.subscription_id === s.id && x.month.slice(0, 7) === month
    );
    return {
      id: s.id,
      name: s.name,
      amount: h ? Number(h.amount) : Number(s.amount),
      recurring: s.is_recurring,
      hidden: s.hidden,
    };
  });

  // Available cash flow for the month drives percentage-budget resolution.
  const incomeTotal = incomeRows
    .filter((r) => !r.hidden)
    .reduce((sum, r) => sum + r.amount, 0);
  const paymentTotal = paymentRows
    .filter((r) => !r.hidden)
    .reduce((sum, r) => sum + r.amount, 0);
  const availableCashFlow = incomeTotal - paymentTotal;

  const budgetRows = budgetSpend(month, data.budgets, data.expenses).map(({ budget, spent }) => {
    const resolvedLimit =
      budget.limit_percent != null
        ? Math.round(availableCashFlow * (Number(budget.limit_percent) / 100) * 100) / 100
        : Number(budget.monthly_limit);
    return {
      id: budget.id,
      name: budget.name,
      emoji: budget.emoji,
      limit: resolvedLimit,
      limitPercent: budget.limit_percent,
      spent,
    };
  });

  const revenue = monthlyRevenue(month, data.incomeItems, data.incomeHistory);
  const spend = monthlySpend(month, data.expenses, data.subscriptions, data.subscriptionHistory);
  const worth = netWorth(data.accounts);

  return {
    accounts: accountRows,
    income: incomeRows,
    payments: paymentRows,
    budgets: budgetRows,
    totals: {
      netWorth: worth,
      revenue,
      spend,
      cashFlow: availableCashFlow,
      netWorthChange: revenue - spend,
    },
  };
}
