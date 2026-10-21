"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

/**
 * Spreadsheet-style table for Monthly Items: items as rows (income first, then
 * payments shown negative), months as columns (oldest → newest). Includes
 * Total Income, Total Payments, and Available Cash Flow rows.
 * Any cell can be clicked to inline-edit that month's amount.
 */
export default function MonthlyItemsTable({
  incomeItems,
  incomeHistory,
  subscriptions,
  subscriptionHistory,
  now: nowProp,
  onUpdateCell,
}: {
  incomeItems: IncomeItem[];
  incomeHistory: IncomeHistory[];
  subscriptions: Subscription[];
  subscriptionHistory: SubscriptionHistory[];
  now?: string;
  onUpdateCell?: (
    kind: "income" | "subscription",
    itemId: string,
    month: string,
    amount: number | null
  ) => void | Promise<void>;
}) {
  const router = useRouter();
  const [editingCell, setEditingCell] = useState<{
    kind: "income" | "subscription";
    itemId: string;
    month: string;
  } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);

  if (incomeItems.length === 0 && subscriptions.length === 0) return null;

  const now = nowProp ?? currentMonth();

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

  function startEdit(
    kind: "income" | "subscription",
    itemId: string,
    month: string,
    currentVal: number
  ) {
    setEditingCell({ kind, itemId, month });
    setDraftValue(String(Math.abs(currentVal)));
  }

  async function commitEdit(
    kind: "income" | "subscription",
    itemId: string,
    month: string
  ) {
    setSaving(true);
    const trimmed = draftValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const normalized = parsed !== null && !isNaN(parsed) ? Math.abs(parsed) : null;

    if (onUpdateCell) {
      await onUpdateCell(kind, itemId, month, normalized);
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

    const table = kind === "income" ? "income_items" : "subscriptions";
    const historyTable = kind === "income" ? "income_history" : "subscription_history";
    const fk = kind === "income" ? "income_id" : "subscription_id";

    if (month === now) {
      await supabase
        .from(table)
        .update({ amount: normalized ?? 0 })
        .eq("id", itemId);
    } else if (normalized === null) {
      await supabase
        .from(historyTable)
        .delete()
        .eq(fk, itemId)
        .eq("month", `${month}-01`);
    } else {
      await supabase.from(historyTable).upsert(
        {
          user_id: user.id,
          [fk]: itemId,
          month: `${month}-01`,
          amount: normalized,
        },
        { onConflict: `${fk},month` }
      );
    }

    setSaving(false);
    setEditingCell(null);
    router.refresh();
  }

  const incomeColTotal = (m: string) =>
    incomeItems.reduce((sum, i) => sum + rawIncome(i, m), 0);
  const subColTotal = (m: string) =>
    subscriptions.reduce((sum, s) => sum + rawSubscription(s, m), 0);

  // Sort each section highest value first (by current amount).
  const sortedIncome = [...incomeItems].sort((a, b) => Number(b.amount) - Number(a.amount));
  const sortedSubs = [...subscriptions].sort((a, b) => Number(b.amount) - Number(a.amount));

  const headerCell = "whitespace-nowrap px-3 py-2 text-right font-medium";
  const bodyCell = "whitespace-nowrap px-3 py-2 text-right";
  const stickyName = "sticky left-0 whitespace-nowrap bg-background px-3 py-2";
  const currentCol = "bg-blue-100 dark:bg-blue-950";

  return (
    <section className="rounded border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-lg font-medium">Monthly Items History</h2>
        <span className="text-xs text-gray-500">Click any cell to edit its monthly amount</span>
      </div>
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
            {sortedIncome.map((item) => (
              <ItemRow
                key={item.id}
                id={item.id}
                name={item.name}
                kind="income"
                months={months}
                now={now}
                valueFor={(m) => rawIncome(item, m)}
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
              label="Total Income"
              months={months}
              now={now}
              valueFor={incomeColTotal}
              stickyName={stickyName}
              bodyCell={bodyCell}
              currentCol={currentCol}
              accent="text-green-600"
            />

            {sortedSubs.map((sub) => (
              <ItemRow
                key={sub.id}
                id={sub.id}
                name={sub.name}
                kind="subscription"
                months={months}
                now={now}
                valueFor={(m) => -rawSubscription(sub, m)}
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
              label="Total Payments"
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
  id,
  name,
  kind,
  months,
  now,
  valueFor,
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
  id: string;
  name: string;
  kind: "income" | "subscription";
  months: string[];
  now: string;
  valueFor: (month: string) => number;
  editingCell: { kind: "income" | "subscription"; itemId: string; month: string } | null;
  draftValue: string;
  saving: boolean;
  onStartEdit: (
    kind: "income" | "subscription",
    itemId: string,
    month: string,
    currentVal: number
  ) => void;
  onDraftChange: (v: string) => void;
  onCommit: (kind: "income" | "subscription", itemId: string, month: string) => void;
  onCancel: () => void;
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
          {kind === "subscription" ? "Pay" : "Inc"}
        </span>
      </td>
      {months.map((m) => {
        const isEditing =
          editingCell?.kind === kind &&
          editingCell?.itemId === id &&
          editingCell?.month === m;
        const value = valueFor(m);
        return (
          <td
            key={m}
            onClick={() => {
              if (!isEditing) onStartEdit(kind, id, m, value);
            }}
            title="Click to edit amount for this month"
            className={`${bodyCell} ${m === now ? currentCol : ""} ${
              !isEditing ? "cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70" : ""
            } ${value < 0 ? "text-red-600" : ""}`}
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
                    if (e.key === "Enter") onCommit(kind, id, m);
                    if (e.key === "Escape") onCancel();
                  }}
                  className="w-24 rounded border bg-background px-1.5 py-0.5 text-right text-xs text-foreground"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onCommit(kind, id, m)}
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
