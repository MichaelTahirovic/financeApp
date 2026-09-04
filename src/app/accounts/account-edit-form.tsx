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
  const [hidden, setHidden] = useState(account.hidden);
  const [isAnnual, setIsAnnual] = useState(account.is_annual_subscription);
  const [annualAmount, setAnnualAmount] = useState(
    account.annual_amount != null ? String(account.annual_amount) : ""
  );
  // Months that exist in the DB when the editor opens — used to detect removals.
  const [initialMonths] = useState<string[]>(history.map((h) => h.month.slice(0, 7)));
  const [rows, setRows] = useState<HistoryDraft[]>(
    history.map((h) => ({
      month: h.month.slice(0, 7),
      amount: String(h.amount),
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHideInfo, setShowHideInfo] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the account "${account.name}" and all its history? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("flow_accounts").delete().eq("id", account.id);
    setDeleting(false);
    if (error) {
      setError(error.message);
      return;
    }
    onClose();
    router.refresh();
  }

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

    // Upsert the rows still present.
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

    // Delete any originally-present months the user removed.
    const keptMonths = new Set(validRows.map((r) => r.month));
    const removedMonths = initialMonths.filter((m) => !keptMonths.has(m));
    if (removedMonths.length > 0) {
      const { error: deleteError } = await supabase
        .from("account_history")
        .delete()
        .eq("account_id", account.id)
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

    const { error: updateError } = await supabase
      .from("flow_accounts")
      .update({
        amount: Number(currentValue) || 0,
        hidden,
        is_annual_subscription: account.kind === "payable" && isAnnual,
        annual_amount: account.kind === "payable" && isAnnual ? Number(annualAmount) || 0 : null,
      })
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

      {account.kind === "payable" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAnnual}
              onChange={(e) => setIsAnnual(e.target.checked)}
            />
            Annual Payment?
          </label>
          {isAnnual && (
            <input
              type="number"
              step="0.01"
              placeholder="Annual cost"
              required
              value={annualAmount}
              onChange={(e) => setAnnualAmount(e.target.value)}
              className="w-32 rounded border px-2 py-1"
            />
          )}
          {isAnnual && annualAmount && (
            <span className="text-xs text-gray-500">
              accrues {(Number(annualAmount) / 12).toFixed(2)}/month
            </span>
          )}
        </div>
      )}

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
            aria-label="About hiding accounts"
            aria-expanded={showHideInfo}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] leading-none text-gray-500 hover:text-black dark:hover:text-white"
          >
            i
          </button>
        </label>
        {showHideInfo && (
          <p className="text-xs text-gray-500">
            Keeps this account saved but removes it from the Accounts page and history chart.
          </p>
        )}
      </div>

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
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary px-3 py-1 text-xs"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-xs">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto rounded border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </form>
  );
}
