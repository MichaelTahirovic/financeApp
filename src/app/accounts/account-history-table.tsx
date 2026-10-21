"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  bySortOrder,
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
 * Any cell can be clicked to inline-edit that month's balance (or the current month's
 * balance).
 */
export default function AccountHistoryTable({
  accounts,
  history,
  now: nowProp,
  onUpdateCell,
}: {
  accounts: FlowAccount[];
  history: AccountHistory[];
  now?: string;
  onUpdateCell?: (
    account: FlowAccount,
    month: string,
    amount: number | null
  ) => void | Promise<void>;
}) {
  const router = useRouter();
  const [editingCell, setEditingCell] = useState<{ accountId: string; month: string } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);

  if (accounts.length === 0) return null;

  const now = nowProp ?? currentMonth();

  // All months that have any history entry, plus the current month.
  const monthSet = new Set<string>(history.map((h) => h.month.slice(0, 7)));
  monthSet.add(now);
  const months = [...monthSet].sort(); // oldest first

  // Guarantee a sensible minimum window of columns even with little history.
  while (months.length < 4) {
    months.unshift(shiftMonth(months[0], -1));
  }

  const receivables = bySortOrder(accounts.filter((a) => a.kind === "receivable"));
  const payables = bySortOrder(accounts.filter((a) => a.kind === "payable"));

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

  function startEdit(account: FlowAccount, month: string) {
    const raw = rawValue(account, month);
    setEditingCell({ accountId: account.id, month });
    setDraftValue(raw !== null ? String(raw) : "");
  }

  async function commitEdit(account: FlowAccount, month: string) {
    setSaving(true);
    const trimmed = draftValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const normalized = parsed !== null && !isNaN(parsed) ? Math.abs(parsed) : null;

    if (onUpdateCell) {
      await onUpdateCell(account, month, normalized);
      setSaving(false);
      setEditingCell(null);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setEditingCell(null);
      return;
    }

    if (month === now) {
      await supabase
        .from("flow_accounts")
        .update({ amount: normalized ?? 0 })
        .eq("id", account.id);
    } else if (normalized === null) {
      await supabase
        .from("account_history")
        .delete()
        .eq("account_id", account.id)
        .eq("month", `${month}-01`);
    } else {
      await supabase.from("account_history").upsert(
        {
          user_id: user.id,
          account_id: account.id,
          month: `${month}-01`,
          amount: normalized,
        },
        { onConflict: "account_id,month" }
      );
    }

    setSaving(false);
    setEditingCell(null);
    router.refresh();
  }

  const headerCell = "whitespace-nowrap px-3 py-2 text-right font-medium";
  const bodyCell = "whitespace-nowrap px-3 py-2 text-right";
  const stickyName = "sticky left-0 whitespace-nowrap bg-background px-3 py-2";
  const currentCol = "bg-blue-100 dark:bg-blue-950";

  return (
    <section className="rounded border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-lg font-medium">Account History</h2>
        <span className="text-xs text-gray-500">Click any cell to edit its monthly balance</span>
      </div>
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
                editingCell={editingCell}
                draftValue={draftValue}
                saving={saving}
                onStartEdit={startEdit}
                onDraftChange={setDraftValue}
                onCommit={commitEdit}
                onCancel={() => setEditingCell(null)}
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
                editingCell={editingCell}
                draftValue={draftValue}
                saving={saving}
                onStartEdit={startEdit}
                onDraftChange={setDraftValue}
                onCommit={commitEdit}
                onCancel={() => setEditingCell(null)}
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
  editingCell,
  draftValue,
  saving,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  stickyName,
  bodyCell,
  currentCol,
}: {
  account: FlowAccount;
  months: string[];
  now: string;
  displayValue: (account: FlowAccount, month: string) => number | null;
  editingCell: { accountId: string; month: string } | null;
  draftValue: string;
  saving: boolean;
  onStartEdit: (account: FlowAccount, month: string) => void;
  onDraftChange: (v: string) => void;
  onCommit: (account: FlowAccount, month: string) => void;
  onCancel: () => void;
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
        const isEditing =
          editingCell?.accountId === account.id && editingCell?.month === m;
        const value = displayValue(account, m);
        return (
          <td
            key={m}
            onClick={() => {
              if (!isEditing) onStartEdit(account, m);
            }}
            title="Click to edit balance for this month"
            className={`${bodyCell} ${m === now ? currentCol : ""} ${
              !isEditing ? "cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70" : ""
            } ${
              value === null
                ? "text-neutral-300 dark:text-neutral-600"
                : value < 0
                  ? "text-red-600"
                  : ""
            }`}
          >
            {isEditing ? (
              <span
                className="inline-flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  disabled={saving}
                  value={draftValue}
                  placeholder="0.00"
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onCommit(account, m);
                    if (e.key === "Escape") onCancel();
                  }}
                  className="w-24 rounded border bg-background px-1.5 py-0.5 text-right text-xs text-foreground"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onCommit(account, m)}
                  className="rounded border bg-black px-1.5 py-0.5 text-xs text-white dark:bg-white dark:text-black"
                >
                  ✓
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onCancel}
                  className="rounded border px-1.5 py-0.5 text-xs text-foreground"
                >
                  ×
                </button>
              </span>
            ) : value === null ? (
              "—"
            ) : (
              formatCurrency(value)
            )}
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
