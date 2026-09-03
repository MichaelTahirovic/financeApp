import type {
  AccountHistory,
  Budget,
  Expense,
  FlowAccount,
  IncomeHistory,
  IncomeItem,
  PurchaseType,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";

/** "YYYY-MM" key for a Date, in local time. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First day of the month as YYYY-MM-DD, for DB month columns. */
export function monthStart(month: string): string {
  return `${month}-01`;
}

export function currentMonth(): string {
  return monthKey(new Date());
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function inMonth(dateStr: string, month: string): boolean {
  return dateStr.slice(0, 7) === month;
}

/** Monthly accrual for an annual subscription: 1/12 of the annual cost. */
export function annualAccrual(account: FlowAccount): number {
  if (!account.is_annual_subscription || !account.annual_amount) return 0;
  return Number(account.annual_amount) / 12;
}

/**
 * Effective monthly payable amount for a flow account:
 * annual subscriptions contribute their 1/12 accrual, everything else its amount.
 */
export function effectiveMonthlyAmount(account: FlowAccount): number {
  if (account.kind === "payable" && account.is_annual_subscription) {
    return annualAccrual(account);
  }
  return Number(account.amount);
}

/** Accounts that are not hidden — shown in cards, totals, and the history table. */
export function visibleAccounts(accounts: FlowAccount[]): FlowAccount[] {
  return accounts.filter((a) => !a.hidden);
}

/** Sort accounts by their persisted per-kind order, falling back to creation order. */
export function bySortOrder(accounts: FlowAccount[]): FlowAccount[] {
  return [...accounts].sort((a, b) => {
    const so = (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
    return so !== 0 ? so : a.created_at.localeCompare(b.created_at);
  });
}

export function receivableTotal(accounts: FlowAccount[]): number {
  return accounts
    .filter((a) => a.kind === "receivable")
    .reduce((sum, a) => sum + Number(a.amount), 0);
}

/**
 * Monthly change for an account: effective current value minus the most recent
 * recorded previous month. Returns 0 when there is no prior month recorded.
 * `now` should be computed once on the server and passed down so SSR and
 * hydration agree at month boundaries.
 */
export function monthlyChange(
  account: FlowAccount,
  history: AccountHistory[],
  now: string = currentMonth()
): number {
  const prior = history
    .filter((h) => h.account_id === account.id)
    .map((h) => h.month.slice(0, 7))
    .filter((m) => m < now)
    .sort()
    .pop();

  if (!prior) return 0;

  const priorEntry = history.find(
    (h) => h.account_id === account.id && h.month.slice(0, 7) === prior
  );
  return effectiveMonthlyAmount(account) - Number(priorEntry?.amount ?? 0);
}

/** Accounts Payable total, counting annual subscriptions at their monthly accrual. */
export function payableTotal(accounts: FlowAccount[]): number {
  return accounts
    .filter((a) => a.kind === "payable")
    .reduce((sum, a) => sum + effectiveMonthlyAmount(a), 0);
}

/** Net worth = Accounts Receivable total − Accounts Payable total. */
export function netWorth(accounts: FlowAccount[]): number {
  return receivableTotal(accounts) - payableTotal(accounts);
}

/** Debt = total Accounts Payable. */
export function debt(accounts: FlowAccount[]): number {
  return payableTotal(accounts);
}

/**
 * Total spend for a month: logged purchases in that month plus every
 * subscription (recurring and one-off). For past months, recorded history
 * entries override their subscription's amount.
 */
export function monthlySpend(
  month: string,
  expenses: Expense[],
  subscriptions: Subscription[],
  subscriptionHistory: SubscriptionHistory[]
): number {
  const purchaseTotal = expenses
    .filter((e) => inMonth(e.occurred_on, month))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const historyForMonth = subscriptionHistory.filter((h) => inMonth(h.month, month));
  const withHistory = new Set(historyForMonth.map((h) => h.subscription_id));
  const subscriptionTotal =
    historyForMonth.reduce((sum, h) => sum + Number(h.amount), 0) +
    subscriptions
      .filter((s) => !s.hidden && !withHistory.has(s.id))
      .reduce((sum, s) => sum + Number(s.amount), 0);

  return purchaseTotal + subscriptionTotal;
}

/**
 * Total revenue for a month: every income item counts (recurring and one-off);
 * history entries override their item's amount for past months.
 */
export function monthlyRevenue(
  month: string,
  incomeItems: IncomeItem[],
  incomeHistory: IncomeHistory[]
): number {
  const historyForMonth = incomeHistory.filter((h) => inMonth(h.month, month));
  const withHistory = new Set(historyForMonth.map((h) => h.income_id));

  return (
    historyForMonth.reduce((sum, h) => sum + Number(h.amount), 0) +
    incomeItems
      .filter((i) => !i.hidden && !withHistory.has(i.id))
      .reduce((sum, i) => sum + Number(i.amount), 0)
  );
}

/** Monthly net worth difference = this month's revenue − this month's spend. */
export function monthlyNetWorthDifference(
  month: string,
  expenses: Expense[],
  subscriptions: Subscription[],
  subscriptionHistory: SubscriptionHistory[],
  incomeItems: IncomeItem[],
  incomeHistory: IncomeHistory[]
): number {
  return (
    monthlyRevenue(month, incomeItems, incomeHistory) -
    monthlySpend(month, expenses, subscriptions, subscriptionHistory)
  );
}

export interface BudgetSpend {
  budget: Budget;
  spent: number;
}

/** Spent-this-month vs. limit, per budget. */
export function budgetSpend(month: string, budgets: Budget[], expenses: Expense[]): BudgetSpend[] {
  return budgets.map((budget) => ({
    budget,
    spent: expenses
      .filter((e) => e.budget_id === budget.id && inMonth(e.occurred_on, month))
      .reduce((sum, e) => sum + Number(e.amount), 0),
  }));
}

// A fixed palette; a purchase type with no stored colour gets one derived
// deterministically from its name so colours are stable across sessions.
const COLOR_PALETTE = [
  "#34d399", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa",
  "#f87171", "#4ade80", "#38bdf8", "#fb923c", "#e879f9",
  "#2dd4bf", "#facc15", "#818cf8", "#f97316", "#22d3ee",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Deterministic colour for a purchase type name (used when none is stored). */
export function colorForName(name: string): string {
  return COLOR_PALETTE[hashString(name.trim().toLowerCase()) % COLOR_PALETTE.length];
}

/** Resolved colour for a purchase type: stored colour wins, else name-derived. */
export function purchaseTypeColor(type: { name: string; color?: string | null }): string {
  return type.color || colorForName(type.name);
}

export interface TypeSpend {
  name: string;
  color: string;
  spent: number;
}

/**
 * Per-purchase-type spend for a budget in a month, for the segmented bar.
 * Falls back to "General" for expenses with no type.
 */
export function budgetSpendByType(
  month: string,
  budget: Budget,
  expenses: Expense[],
  types: PurchaseType[]
): TypeSpend[] {
  const budgetTypes = types.filter((t) => t.budget_id === budget.id);
  const colorOf = new Map(budgetTypes.map((t) => [t.name, purchaseTypeColor(t)]));

  const monthExpenses = expenses.filter(
    (e) => e.budget_id === budget.id && inMonth(e.occurred_on, month)
  );

  const totals = new Map<string, number>();
  for (const e of monthExpenses) {
    const key = e.purchase_type || "General";
    totals.set(key, (totals.get(key) ?? 0) + Number(e.amount));
  }

  return [...totals.entries()].map(([name, spent]) => ({
    name,
    color: colorOf.get(name) ?? colorForName(name),
    spent,
  }));
}

export interface ForecastResult {
  /** The month being forecast (always the month after the current one). */
  targetMonth: string;
  /** Months of history actually used. */
  monthsUsed: string[];
  /** Estimated total spend for the target month. */
  estimate: number;
  /** True when fewer than 3 months of data existed and the previous month was used directly. */
  usedFallback: boolean;
}

/**
 * Forecast next month's spending.
 * - With 3+ months of history: average of the last 3 months' total spend.
 * - With less: forecast equals the previous month's total spend.
 */
export function forecastNextMonth(
  expenses: Expense[],
  subscriptions: Subscription[],
  subscriptionHistory: SubscriptionHistory[]
): ForecastResult {
  const now = currentMonth();
  const targetMonth = shiftMonth(now, 1);

  const spendFor = (month: string) =>
    monthlySpend(month, expenses, subscriptions, subscriptionHistory);

  const candidates = [shiftMonth(now, -1), shiftMonth(now, -2), shiftMonth(now, -3)];
  const totals = candidates.map((m) => ({ month: m, total: spendFor(m) }));
  const monthsWithData = totals.filter((t) => t.total > 0);

  if (monthsWithData.length >= 3) {
    const used = totals; // all three
    const estimate = used.reduce((sum, t) => sum + t.total, 0) / 3;
    return { targetMonth, monthsUsed: used.map((t) => t.month), estimate, usedFallback: false };
  }

  const previous = totals[0];
  return {
    targetMonth,
    monthsUsed: [previous.month],
    estimate: previous.total,
    usedFallback: true,
  };
}
