"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { colorForName } from "@/lib/finance/calculations";
import type { Budget, PurchaseType } from "@/types/finance";

const NEW_TYPE = "__new__";

/**
 * Log a purchase against a budget. The purchase-type input is a dropdown of the
 * selected budget's types plus a "New type..." option that saves a new type to
 * that budget's list.
 */
export default function ExpenseForm({
  budgets,
  purchaseTypes,
}: {
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
}) {
  const router = useRouter();
  const [budgetId, setBudgetId] = useState(budgets[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [typeChoice, setTypeChoice] = useState("General");
  const [newTypeName, setNewTypeName] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const typesForBudget = useMemo(
    () => purchaseTypes.filter((t) => t.budget_id === budgetId),
    [purchaseTypes, budgetId]
  );

  function onBudgetChange(id: string) {
    setBudgetId(id);
    setTypeChoice("General");
    setNewTypeName("");
  }

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
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    // Resolve the purchase type, creating a new one for this budget if needed.
    let purchaseType = typeChoice === NEW_TYPE ? newTypeName.trim() : typeChoice;
    if (typeChoice === NEW_TYPE) {
      if (!purchaseType) {
        setError("Enter a name for the new purchase type.");
        setSaving(false);
        return;
      }
      const { error: typeError } = await supabase.from("purchase_types").upsert(
        {
          user_id: user.id,
          budget_id: budgetId,
          name: purchaseType,
          color: colorForName(purchaseType),
        },
        { onConflict: "budget_id,name" }
      );
      if (typeError) {
        setError(typeError.message);
        setSaving(false);
        return;
      }
    }
    if (purchaseType === "General") purchaseType = "General";

    const { error } = await supabase.from("expenses").insert({
      user_id: user.id,
      budget_id: budgetId,
      amount: Number(amount),
      name: name || null,
      purchase_type: purchaseType,
      occurred_on: occurredOn,
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAmount("");
    setName("");
    setTypeChoice("General");
    setNewTypeName("");
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
          onChange={(e) => onBudgetChange(e.target.value)}
          required
          className="flex-1 rounded border bg-white px-2 py-1.5 text-black"
        >
          {budgets.map((b) => (
            <option key={b.id} value={b.id} className="text-black">
              {b.emoji ? `${b.emoji} ` : ""}
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={typeChoice}
          onChange={(e) => setTypeChoice(e.target.value)}
          className="flex-1 rounded border bg-white px-2 py-1.5 text-black"
        >
          <option value="General" className="text-black">
            General
          </option>
          {typesForBudget.map((t) => (
            <option key={t.id} value={t.name} className="text-black">
              {t.name}
            </option>
          ))}
          <option value={NEW_TYPE} className="text-black">
            + New type…
          </option>
        </select>
        {typeChoice === NEW_TYPE && (
          <input
            type="text"
            placeholder="New type name"
            required
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            className="flex-1 rounded border px-2 py-1.5"
          />
        )}
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
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="rounded border px-2 py-1.5 dark:[color-scheme:dark]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary px-3 py-2">
        {saving ? "Saving..." : "Log Purchase"}
      </button>
    </form>
  );
}
