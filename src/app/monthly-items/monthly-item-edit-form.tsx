"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { IncomeItem, Subscription } from "@/types/finance";

interface HistoryDraft {
  month: string; // YYYY-MM
  amount: string;
}

type Item = IncomeItem | Subscription;

/**
 * Inline editor for one income item or subscription: name, amount, recurring
 * toggle, hide checkbox (info tooltip), and editable monthly history with
 * upsert + deletion of removed months.
 */
export default function MonthlyItemEditForm({
  item,
  history,
  table,
  historyTable,
  historyFk,
  onClose,
}: {
  item: Item;
  history: { id: string; month: string; amount: number }[];
  table: "income_items" | "subscriptions";
  historyTable: "income_history" | "subscription_history";
  historyFk: "income_id" | "subscription_id";
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [recurring, setRecurring] = useState(item.is_recurring);
  const [hidden, setHidden] = useState(item.hidden);
  const [showHideInfo, setShowHideInfo] = useState(false);
  const [initialMonths] = useState<string[]>(history.map((h) => h.month.slice(0, 7)));
  const [rows, setRows] = useState<HistoryDraft[]>(
    history.map((h) => ({ month: h.month.slice(0, 7), amount: String(h.amount) }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, field: keyof HistoryDraft, value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };
    setRows(next);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const validRows = rows.filter((r) => r.month && r.amount !== "");
    const seen = new Set<string>();
    for (const r of validRows) {
      if (seen.has(r.month)) {
        setError(`Duplicate month ${r.month} — keep only one entry per month.`);
        setSaving(false);
        return;
      }
      seen.add(r.month);
    }

    // Upsert remaining history rows.
    if (validRows.length > 0) {
      const { error: historyError } = await supabase.from(historyTable).upsert(
        validRows.map((r) => ({
          user_id: user.id,
          [historyFk]: item.id,
          month: `${r.month}-01`,
          amount: Number(r.amount),
        })),
        { onConflict: `${historyFk},month` }
      );
      if (historyError) {
        setError(historyError.message);
        setSaving(false);
        return;
      }
    }

    // Delete removed months.
    const keptMonths = new Set(validRows.map((r) => r.month));
    const removedMonths = initialMonths.filter((m) => !keptMonths.has(m));
    if (removedMonths.length > 0) {
      const { error: deleteError } = await supabase
        .from(historyTable)
        .delete()
        .eq(historyFk, item.id)
        .in(
          "month",
          removedMonths.map((m) => `${m}-01`)
        );
      if (deleteError) {
        setError(deleteError.message);
        setSaving(false);
        return;
      }
    }

    // Update the item itself.
    const { error: updateError } = await supabase
      .from(table)
      .update({
        name,
        amount: Number(amount) || 0,
        is_recurring: recurring,
        hidden,
      })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="mt-2 flex flex-col gap-2 border-t pt-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-24 text-gray-600">Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded border px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-24 text-gray-600">Amount</span>
        <input
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 rounded border px-2 py-1"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
        />
        Recur every month
      </label>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
          />
          Hide
          <button
            type="button"
            onClick={() => setShowHideInfo((v) => !v)}
            aria-label="About hiding"
            aria-expanded={showHideInfo}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] leading-none text-gray-500 hover:text-black dark:hover:text-white"
          >
            i
          </button>
        </label>
        {showHideInfo && (
          <p className="text-xs text-gray-500">
            Keeps this item saved but removes it from the cards, history table, and totals.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">History</span>
          <button
            type="button"
            onClick={() => setRows([...rows, { month: "", amount: "" }])}
            className="rounded border px-2 py-0.5 text-xs"
          >
            + Add month
          </button>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              type="month"
              value={row.month}
              onChange={(e) => updateRow(i, "month", e.target.value)}
              className="min-w-0 flex-1 rounded border px-2 py-0.5 text-xs dark:[color-scheme:dark]"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => updateRow(i, "amount", e.target.value)}
              className="w-24 min-w-0 rounded border px-2 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              aria-label="Remove month"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary px-3 py-1 text-xs">
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
