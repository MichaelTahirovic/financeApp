"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AccountHistory, FlowAccount } from "@/types/finance";

interface HistoryDraft {
  month: string; // YYYY-MM
  amount: string;
}

/**
 * Inline editor for one account: current value plus editable monthly history.
 * Current value updates flow_accounts.amount; history rows upsert into
 * account_history on (account_id, month).
 */
export default function AccountEditForm({
  account,
  history,
  onClose,
}: {
  account: FlowAccount;
  history: AccountHistory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [currentValue, setCurrentValue] = useState(String(account.amount));
  const [rows, setRows] = useState<HistoryDraft[]>(
    history.map((h) => ({
      month: h.month.slice(0, 7),
      amount: String(h.amount),
    }))
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

    // Reject duplicate months up front — Postgres rejects a multi-row upsert
    // where two rows target the same (account_id, month) key, which would
    // otherwise fail after the current value was already saved.
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

    if (validRows.length > 0) {
      const { error: historyError } = await supabase.from("account_history").upsert(
        validRows.map((r) => ({
          user_id: user.id,
          account_id: account.id,
          month: `${r.month}-01`,
          amount: Number(r.amount),
        })),
        { onConflict: "account_id,month" }
      );

      if (historyError) {
        setError(historyError.message);
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("flow_accounts")
      .update({ amount: Number(currentValue) || 0 })
      .eq("id", account.id);

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
        <span className="w-32 text-gray-600">Current value</span>
        <input
          type="number"
          step="0.01"
          required
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="w-32 rounded border px-2 py-1"
        />
      </label>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Previous months</span>
          <button
            type="button"
            onClick={() => setRows([...rows, { month: "", amount: "" }])}
            className="rounded border px-2 py-0.5 text-xs"
          >
            + Add month
          </button>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="month"
              value={row.month}
              onChange={(e) => updateRow(i, "month", e.target.value)}
              className="rounded border px-2 py-0.5 text-xs"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => updateRow(i, "amount", e.target.value)}
              className="w-28 rounded border px-2 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              className="text-xs text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}
