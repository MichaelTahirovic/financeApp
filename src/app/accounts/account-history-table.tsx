import {
  currentMonth,
  effectiveMonthlyAmount,
  formatCurrency,
  monthLabel,
  shiftMonth,
} from "@/lib/finance/calculations";
import type { AccountHistory, FlowAccount } from "@/types/finance";

/**
 * Spreadsheet-style history table: accounts as rows, months as columns
 * (oldest → newest, left to right). Horizontally scrollable.
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

  function cellValue(account: FlowAccount, month: string): number | null {
    if (month === now) return effectiveMonthlyAmount(account);
    const entry = history.find(
      (h) => h.account_id === account.id && h.month.slice(0, 7) === month
    );
    return entry ? Number(entry.amount) : null;
  }

  return (
    <section className="rounded border">
      <h2 className="border-b px-4 py-2 text-lg font-medium">Account History</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium">
                Account
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                    m === now ? "bg-blue-50" : ""
                  }`}
                >
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b last:border-0">
                <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 font-medium">
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
                  const value = cellValue(account, m);
                  return (
                    <td
                      key={m}
                      className={`whitespace-nowrap px-3 py-2 text-right ${
                        m === now ? "bg-blue-50" : ""
                      } ${value === null ? "text-gray-300" : ""}`}
                    >
                      {value === null ? "—" : formatCurrency(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
