"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Budget } from "@/types/finance";

export default function ExpenseForm({ budgets }: { budgets: Budget[] }) {
  const router = useRouter();
  const [budgetId, setBudgetId] = useState(budgets[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [purchaseType, setPurchaseType] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!budgetId) {
      setError("Create a budget first.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("expenses").insert({
      user_id: user?.id,
      budget_id: budgetId,
      amount: Number(amount),
      name: name || null,
      purchase_type: purchaseType || null,
      occurred_on: occurredOn,
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAmount("");
    setName("");
    setPurchaseType("");
    router.refresh();
  }

  if (budgets.length === 0) {
    return <p className="text-sm text-gray-500">Create a budget above first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Cost"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 rounded border px-2 py-1.5"
        />
        <select
          value={budgetId}
          onChange={(e) => setBudgetId(e.target.value)}
          required
          className="flex-1 rounded border px-2 py-1.5"
        >
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Purchase name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border px-2 py-1.5"
        />
        <input
          type="text"
          placeholder="Type of purchase (optional)"
          value={purchaseType}
          onChange={(e) => setPurchaseType(e.target.value)}
          className="flex-1 rounded border px-2 py-1.5"
        />
        <input
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="rounded border px-2 py-1.5"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Log Purchase"}
      </button>
    </form>
  );
}
