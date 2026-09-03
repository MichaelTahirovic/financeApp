import {
  currentMonth,
  effectiveMonthlyAmount,
  formatCurrency,
  monthLabel,
  shiftMonth,
} from "@/lib/finance/calculations";
import type { AccountHistory, FlowAccount } from "@/types/finance";

/**
 * Spreadsheet-style history table: accounts as rows (receivable first, then payable),
 * months as columns (oldest → newest, left to right). Payable amounts are displayed
 * as negative. Includes Total Receivable, Total Payable, and Total Net Worth rows.
 * Theme-aware for light/dark mode. Horizontally scrollable.
 */
export default function AccountHistoryTable({
  accounts,
  history,
}: {
  accounts: FlowAccount[];
  history: AccountHistory[];
}) {
  if (accounts.length === 0) return null;

  const now = currentMonth();

  // All months that have any history entry, plus the current month.
  const monthSet = new Set<string>(history.map((h) => h.month.slice(0, 7)));
  monthSet.add(now);
  const months = [...monthSet].sort(); // oldest first

  // Guarantee a sensible minimum window of columns even with little history.
  while (months.length < 4) {
    months.unshift(shiftMonth(months[0], -1));
  }

  const receivables = accounts.filter((a) => a.kind === "receivable");
  const payables = accounts.filter((a) => a.kind === "payable");

  /** Raw stored value for a cell (positive), or null when unrecorded. */
  function rawValue(account: FlowAccount, month: string): number | null {
    if (month === now) return effectiveMonthlyAmount(account);
    const entry = history.find(
      (h) => h.account_id === account.id && h.month.slice(0, 7) === month
    );
    return entry ? Number(entry.amount) : null;
  }

  /** Display value: payable accounts show negative. */
  function displayValue(account: FlowAccount, month: string): number | null {
    const v = rawValue(account, month);
    if (v === null) return null;
    return account.kind === "payable" ? -v : v;
  }

  /** Column total over a set of accounts, treating missing cells as 0. */
  function columnTotal(list: FlowAccount[], month: string): number {
    return list.reduce((sum, a) => sum + (rawValue(a, month) ?? 0), 0);
  }

  const headerCell = "whitespace-nowrap px-3 py-2 text-right font-medium";
  const bodyCell = "whitespace-nowrap px-3 py-2 text-right";
  const stickyName = "sticky left-0 whitespace-nowrap bg-background px-3 py-2";
  const currentCol = "bg-blue-100 dark:bg-blue-950";

  return (
    <section className="rounded border">
      <h2 className="border-b px-4 py-2 text-lg font-medium">Account History</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-neutral-100 dark:bg-neutral-800">
              <th
                className={`sticky left-0 bg-neutral-100 px-3 py-2 text-left font-medium dark:bg-neutral-800`}
              >
                Account
              </th>
              {months.map((m) => (
                <th key={m} className={`${headerCell} ${m === now ? currentCol : ""}`}>
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receivables.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                months={months}
                now={now}
                displayValue={displayValue}
                stickyName={stickyName}
                bodyCell={bodyCell}
                currentCol={currentCol}
              />
            ))}

            <TotalRow
              label="Total Receivable"
              months={months}
              now={now}
              valueFor={(m) => columnTotal(receivables, m)}
              stickyName={stickyName}
              bodyCell={bodyCell}
              currentCol={currentCol}
              accent="text-green-600"
            />

            {payables.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                months={months}
                now={now}
                displayValue={displayValue}
                stickyName={stickyName}
                bodyCell={bodyCell}
                currentCol={currentCol}
              />
            ))}

            <TotalRow
              label="Total Payable"
              months={months}
              now={now}
              valueFor={(m) => -columnTotal(payables, m)}
              stickyName={stickyName}
              bodyCell={bodyCell}
              currentCol={currentCol}
              accent="text-red-600"
            />

            <TotalRow
              label="Total Net Worth"
              months={months}
              now={now}
              valueFor={(m) => columnTotal(receivables, m) - columnTotal(payables, m)}
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

function AccountRow({
  account,
  months,
  now,
  displayValue,
  stickyName,
  bodyCell,
  currentCol,
}: {
  account: FlowAccount;
  months: string[];
  now: string;
  displayValue: (account: FlowAccount, month: string) => number | null;
  stickyName: string;
  bodyCell: string;
  currentCol: string;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className={`${stickyName} font-medium`}>
        {account.name}
        <span
          className={`ml-1 text-xs ${
            account.kind === "payable" ? "text-red-500" : "text-green-600"
          }`}
        >
          {account.kind === "payable" ? "AP" : "AR"}
        </span>
      </td>
      {months.map((m) => {
        const value = displayValue(account, m);
        return (
          <td
            key={m}
            className={`${bodyCell} ${m === now ? currentCol : ""} ${
              value === null
                ? "text-neutral-300 dark:text-neutral-600"
                : value < 0
                  ? "text-red-600"
                  : ""
            }`}
          >
            {value === null ? "—" : formatCurrency(value)}
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
    <tr className={`border-b last:border-0 bg-neutral-50 dark:bg-neutral-900 ${strong ? "border-t-2 border-t-black dark:border-t-white" : ""}`}>
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
