"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface HistoryRow {
  month: string;
  amount: string;
}

/**
 * Shared add-item form for Income and Subscriptions.
 */
export default function MonthlyItemForm({
  table,
  historyTable,
  historyFk,
  recurringDefault = false,
}: {
  table: "income_items" | "subscriptions";
  historyTable: "income_history" | "subscription_history";
  historyFk: "income_id" | "subscription_id";
  recurringDefault?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(recurringDefault);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addHistoryRow() {
    setHistory([...history, { month: "", amount: "" }]);
  }

  function updateHistoryRow(index: number, field: keyof HistoryRow, value: string) {
    const next = [...history];
    next[index] = { ...next[index], [field]: value };
    setHistory(next);
  }

  function removeHistoryRow(index: number) {
    setHistory(history.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
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

    const { data: item, error: insertError } = await supabase
      .from(table)
      .insert({
        user_id: user.id,
        name,
        amount: Number(amount) || 0,
        is_recurring: recurring,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    const historyRows = history
      .filter((h) => h.month && h.amount)
      .map((h) => ({
        user_id: user.id,
        [historyFk]: item.id,
        month: `${h.month}-01`,
        amount: Number(h.amount),
      }));

    if (historyRows.length > 0) {
      const { error: historyError } = await supabase.from(historyTable).insert(historyRows);
      if (historyError) {
        setError(historyError.message);
        setSaving(false);
        return;
      }
    }

    setName("");
    setAmount("");
    setRecurring(recurringDefault);
    setHistory([]);
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded border px-2 py-1 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
        />
        Recur every month
      </label>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">History (optional)</span>
          <button
            type="button"
            onClick={addHistoryRow}
            className="rounded border px-2 py-0.5 text-xs"
          >
            + Add month
          </button>
        </div>
        {history.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="month"
              value={row.month}
              onChange={(e) => updateHistoryRow(i, "month", e.target.value)}
              className="rounded border px-2 py-0.5 text-xs"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => updateHistoryRow(i, "amount", e.target.value)}
              className="w-24 rounded border px-2 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => removeHistoryRow(i)}
              className="text-xs text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Add"}
      </button>
    </form>
  );
}
