"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface HistoryRow {
  month: string; // YYYY-MM
  amount: string;
}

export default function AccountForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"receivable" | "payable">("receivable");
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
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Account name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border px-2 py-1.5"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "receivable" | "payable")}
          className="rounded border px-2 py-1.5"
        >
          <option value="receivable">Receivable</option>
          <option value="payable">Payable</option>
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 rounded border px-2 py-1.5"
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
            Annual Subscription?
          </label>
          {isAnnual && (
            <input
              type="number"
              step="0.01"
              placeholder="Annual cost"
              required
              value={annualAmount}
              onChange={(e) => setAnnualAmount(e.target.value)}
              className="w-32 rounded border px-2 py-1.5"
            />
          )}
          {isAnnual && annualAmount && (
            <span className="text-xs text-gray-500">
              accrues {(Number(annualAmount) / 12).toFixed(2)}/month
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Monthly history (optional)</span>
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
              className="rounded border px-2 py-1"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => updateHistoryRow(i, "amount", e.target.value)}
              className="w-32 rounded border px-2 py-1"
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Add Account"}
      </button>
    </form>
  );
}
