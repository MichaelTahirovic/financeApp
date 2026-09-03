import {
  currentMonth,
  effectiveMonthlyAmount,
  shiftMonth,
} from "@/lib/finance/calculations";
import type { ExportData } from "./page";

/** The last N months as YYYY-MM keys, oldest first. */
export function lastMonths(count: number): string[] {
  const now = currentMonth();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) months.push(shiftMonth(now, -i));
  return months;
}

export interface HistoryCell {
  label: string;
  /** value per month key; null = no record that month */
  values: (number | null)[];
  /** optional sign treatment for display */
  negative?: boolean;
}

export interface HistoryTableData {
  months: string[];
  receivableRows: HistoryCell[];
  payableRows: HistoryCell[];
  totalReceivable: number[];
  totalPayable: number[];
  netWorth: number[];
}

/** Accounts history: rows = accounts (receivable then payable), columns = months. */
export function accountsHistory(data: ExportData, monthCount: number): HistoryTableData {
  const months = lastMonths(monthCount);
  const now = currentMonth();

  function valueFor(account: (typeof data.accounts)[number], month: string): number | null {
    if (month === now) return effectiveMonthlyAmount(account);
    const h = data.accountHistory.find(
      (x) => x.account_id === account.id && x.month.slice(0, 7) === month
    );
    return h ? Number(h.amount) : null;
  }

  const receivables = data.accounts.filter((a) => a.kind === "receivable");
  const payables = data.accounts.filter((a) => a.kind === "payable");

  const receivableRows = receivables.map((a) => ({
    label: a.name,
    values: months.map((m) => valueFor(a, m)),
  }));
  const payableRows = payables.map((a) => ({
    label: a.name,
    negative: true,
    values: months.map((m) => {
      const v = valueFor(a, m);
      return v === null ? null : -v;
    }),
  }));

  const colSum = (rows: HistoryCell[]) =>
    months.map((_, i) => rows.reduce((sum, r) => sum + Math.abs(r.values[i] ?? 0), 0));

  const totalReceivable = colSum(receivableRows);
  const totalPayable = colSum(payableRows);
  const netWorth = months.map((_, i) => totalReceivable[i] - totalPayable[i]);

  return { months, receivableRows, payableRows, totalReceivable, totalPayable, netWorth };
}

export interface MonthlyItemsHistoryData {
  months: string[];
  incomeRows: HistoryCell[];
  paymentRows: HistoryCell[];
  totalIncome: number[];
  totalPayments: number[];
  cashFlow: number[];
}

/** Monthly items history: rows = income then payments, columns = months. */
export function monthlyItemsHistory(data: ExportData, monthCount: number): MonthlyItemsHistoryData {
  const months = lastMonths(monthCount);
  const now = currentMonth();

  function incomeFor(item: (typeof data.incomeItems)[number], month: string): number | null {
    if (month === now) return Number(item.amount);
    const h = data.incomeHistory.find(
      (x) => x.income_id === item.id && x.month.slice(0, 7) === month
    );
    return h ? Number(h.amount) : null;
  }
  function paymentFor(sub: (typeof data.subscriptions)[number], month: string): number | null {
    if (month === now) return Number(sub.amount);
    const h = data.subscriptionHistory.find(
      (x) => x.subscription_id === sub.id && x.month.slice(0, 7) === month
    );
    return h ? Number(h.amount) : null;
  }

  const incomeRows = data.incomeItems.map((i) => ({
    label: i.name,
    values: months.map((m) => incomeFor(i, m)),
  }));
  const paymentRows = data.subscriptions.map((s) => ({
    label: s.name,
    negative: true,
    values: months.map((m) => {
      const v = paymentFor(s, m);
      return v === null ? null : -v;
    }),
  }));

  const colSum = (rows: HistoryCell[]) =>
    months.map((_, i) => rows.reduce((sum, r) => sum + Math.abs(r.values[i] ?? 0), 0));
  const totalIncome = colSum(incomeRows);
  const totalPayments = colSum(paymentRows);
  const cashFlow = months.map((_, i) => totalIncome[i] - totalPayments[i]);

  return { months, incomeRows, paymentRows, totalIncome, totalPayments, cashFlow };
}

export interface BudgetsHistoryData {
  months: string[];
  rows: { label: string; spent: (number | null)[]; limit: number }[];
}

/** Budgets history: rows = budgets, columns = months, value = spent that month. */
export function budgetsHistory(data: ExportData, monthCount: number): BudgetsHistoryData {
  const months = lastMonths(monthCount);
  const rows = data.budgets.map((b) => ({
    label: `${b.emoji ? b.emoji + " " : ""}${b.name}`,
    limit: Number(b.monthly_limit),
    spent: months.map((m) => {
      const total = data.expenses
        .filter((e) => e.budget_id === b.id && e.occurred_on.slice(0, 7) === m)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      return total > 0 ? total : null;
    }),
  }));
  return { months, rows };
}
