import {
  currentMonth,
  formatCurrency,
  monthLabel,
  shiftMonth,
} from "@/lib/finance/calculations";
import type {
  IncomeHistory,
  IncomeItem,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";

type Item = IncomeItem | Subscription;
type History = IncomeHistory | SubscriptionHistory;

/**
 * Spreadsheet-style table for Monthly Items: items as rows (income first, then
 * subscriptions shown negative), months as columns (oldest → newest). Includes
 * Total Income, Total Subscriptions, and Available Cash Flow rows. Theme-aware.
 */
export default function MonthlyItemsTable({
  incomeItems,
  incomeHistory,
  subscriptions,
  subscriptionHistory,
}: {
  incomeItems: IncomeItem[];
  incomeHistory: IncomeHistory[];
  subscriptions: Subscription[];
  subscriptionHistory: SubscriptionHistory[];
}) {
  if (incomeItems.length === 0 && subscriptions.length === 0) return null;

  const now = currentMonth();

  const monthSet = new Set<string>([
    ...incomeHistory.map((h) => h.month.slice(0, 7)),
    ...subscriptionHistory.map((h) => h.month.slice(0, 7)),
  ]);
  monthSet.add(now);
  const months = [...monthSet].sort();
  while (months.length < 4) {
    months.unshift(shiftMonth(months[0], -1));
  }

  function rawIncome(item: IncomeItem, month: string): number {
    if (month === now) return Number(item.amount);
    const entry = incomeHistory.find(
      (h) => h.income_id === item.id && h.month.slice(0, 7) === month
    );
    return entry ? Number(entry.amount) : 0;
  }

  function rawSubscription(sub: Subscription, month: string): number {
    if (month === now) return Number(sub.amount);
    const entry = subscriptionHistory.find(
      (h) => h.subscription_id === sub.id && h.month.slice(0, 7) === month
    );
    return entry ? Number(entry.amount) : 0;
  }

  const incomeColTotal = (m: string) =>
    incomeItems.reduce((sum, i) => sum + rawIncome(i, m), 0);
  const subColTotal = (m: string) =>
    subscriptions.reduce((sum, s) => sum + rawSubscription(s, m), 0);

  const headerCell = "whitespace-nowrap px-3 py-2 text-right font-medium";
  const bodyCell = "whitespace-nowrap px-3 py-2 text-right";
  const stickyName = "sticky left-0 whitespace-nowrap bg-background px-3 py-2";
  const currentCol = "bg-blue-100 dark:bg-blue-950";

  return (
    <section className="rounded border">
      <h2 className="border-b px-4 py-2 text-lg font-medium">Monthly Items History</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-neutral-100 dark:bg-neutral-800">
              <th className="sticky left-0 bg-neutral-100 px-3 py-2 text-left font-medium dark:bg-neutral-800">
                Item
              </th>
              {months.map((m) => (
                <th key={m} className={`${headerCell} ${m === now ? currentCol : ""}`}>
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incomeItems.map((item) => (
              <ItemRow
                key={item.id}
                name={item.name}
                kind="income"
                months={months}
                now={now}
                valueFor={(m) => rawIncome(item, m)}
                stickyName={stickyName}
                bodyCell={bodyCell}
                currentCol={currentCol}
              />
            ))}
            <TotalRow
              label="Total Income"
              months={months}
              now={now}
              valueFor={incomeColTotal}
              stickyName={stickyName}
              bodyCell={bodyCell}
              currentCol={currentCol}
              accent="text-green-600"
            />

            {subscriptions.map((sub) => (
              <ItemRow
                key={sub.id}
                name={sub.name}
                kind="subscription"
                months={months}
                now={now}
                valueFor={(m) => -rawSubscription(sub, m)}
                stickyName={stickyName}
                bodyCell={bodyCell}
                currentCol={currentCol}
              />
            ))}
            <TotalRow
              label="Total Subscriptions"
              months={months}
              now={now}
              valueFor={(m) => -subColTotal(m)}
              stickyName={stickyName}
              bodyCell={bodyCell}
              currentCol={currentCol}
              accent="text-red-600"
            />

            <TotalRow
              label="Available Cash Flow"
              months={months}
              now={now}
              valueFor={(m) => incomeColTotal(m) - subColTotal(m)}
              stickyName={stickyName}
              bodyCell={bodyCell}
              currentCol={currentCol}
              strong
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ItemRow({
  name,
  kind,
  months,
  now,
  valueFor,
  stickyName,
  bodyCell,
  currentCol,
}: {
  name: string;
  kind: "income" | "subscription";
  months: string[];
  now: string;
  valueFor: (month: string) => number;
  stickyName: string;
  bodyCell: string;
  currentCol: string;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className={`${stickyName} font-medium`}>
        {name}
        <span
          className={`ml-1 text-xs ${
            kind === "subscription" ? "text-red-500" : "text-green-600"
          }`}
        >
          {kind === "subscription" ? "Sub" : "Inc"}
        </span>
      </td>
      {months.map((m) => {
        const value = valueFor(m);
        return (
          <td
            key={m}
            className={`${bodyCell} ${m === now ? currentCol : ""} ${
              value < 0 ? "text-red-600" : ""
            }`}
          >
            {formatCurrency(value)}
          </td>
        );
      })}
    </tr>
  );
}

function TotalRow({
  label,
  months,
  now,
  valueFor,
  stickyName,
  bodyCell,
  currentCol,
  accent,
  strong,
}: {
  label: string;
  months: string[];
  now: string;
  valueFor: (month: string) => number;
  stickyName: string;
  bodyCell: string;
  currentCol: string;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <tr
      className={`border-b last:border-0 bg-neutral-50 dark:bg-neutral-900 ${
        strong ? "border-t-2 border-t-black dark:border-t-white" : ""
      }`}
    >
      <td className={`${stickyName} bg-neutral-50 font-bold dark:bg-neutral-900 ${accent ?? ""}`}>
        {label}
      </td>
      {months.map((m) => {
        const value = valueFor(m);
        return (
          <td
            key={m}
            className={`${bodyCell} bg-neutral-50 font-bold dark:bg-neutral-900 ${
              m === now ? currentCol : ""
            } ${accent ?? ""} ${value < 0 ? "text-red-600" : ""}`}
          >
            {formatCurrency(value)}
          </td>
        );
      })}
    </tr>
  );
}
