"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FlowAccountKind } from "@/types/finance";

interface HistoryRow {
  month: string; // YYYY-MM
  amount: string;
}

export default function AccountForm({
  defaultKind = "receivable",
  lockedKind = false,
  onSuccess,
}: {
  defaultKind?: FlowAccountKind;
  lockedKind?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FlowAccountKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [isAnnual, setIsAnnual] = useState(false);
  const [annualAmount, setAnnualAmount] = useState("");
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

    const { data: account, error: insertError } = await supabase
      .from("flow_accounts")
      .insert({
        user_id: user.id,
        name,
        kind,
        amount: Number(amount) || 0,
        is_annual_subscription: kind === "payable" && isAnnual,
        annual_amount: kind === "payable" && isAnnual ? Number(annualAmount) || 0 : null,
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
        account_id: account.id,
        month: `${h.month}-01`,
        amount: Number(h.amount),
      }));

    if (historyRows.length > 0) {
      const { error: historyError } = await supabase.from("account_history").insert(historyRows);
      if (historyError) {
        setError(historyError.message);
        setSaving(false);
        return;
      }
    }

    setName("");
    setAmount("");
    setIsAnnual(false);
    setAnnualAmount("");
    setHistory([]);
    setSaving(false);
    onSuccess?.();
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
        {!lockedKind && (
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as FlowAccountKind)}
            className="rounded border bg-white px-2 py-1 text-sm text-black"
          >
            <option value="receivable" className="text-black">
              Receivable
            </option>
            <option value="payable" className="text-black">
              Payable
            </option>
          </select>
        )}
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

      {kind === "payable" && (
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
              className="w-28 rounded border px-2 py-1 text-sm"
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
          <div key={i} className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              type="month"
              value={row.month}
              onChange={(e) => updateHistoryRow(i, "month", e.target.value)}
              className="min-w-0 flex-1 rounded border px-2 py-0.5 text-xs dark:[color-scheme:dark]"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => updateHistoryRow(i, "amount", e.target.value)}
              className="w-24 min-w-0 rounded border px-2 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => removeHistoryRow(i)}
              aria-label="Remove month"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="btn-primary px-3 py-1.5 text-sm"
      >
        {saving ? "Saving..." : "Add"}
      </button>
    </form>
  );
}
