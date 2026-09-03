"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { colorForName } from "@/lib/finance/calculations";
import type { Budget, Expense, PurchaseType } from "@/types/finance";

const NEW_TYPE = "__new__";

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Log a new purchase, or edit/delete an existing one when `expense` is provided.
 * The purchase-type input is a dropdown of the selected budget's types plus a
 * "New type..." option that saves a new type to that budget's list.
 */
export default function ExpenseForm({
  budgets,
  purchaseTypes,
  expense,
  onClose,
}: {
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
  expense?: Expense;
  onClose?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(expense);

  const [budgetId, setBudgetId] = useState(expense?.budget_id ?? budgets[0]?.id ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [name, setName] = useState(expense?.name ?? "");
  const [typeChoice, setTypeChoice] = useState(expense?.purchase_type ?? "General");
  const [newTypeName, setNewTypeName] = useState("");
  const [occurredOn, setOccurredOn] = useState(
    expense?.occurred_on ?? new Date().toISOString().slice(0, 10)
  );
  const [occurredTime, setOccurredTime] = useState(
    expense?.occurred_time?.slice(0, 5) ?? nowTime()
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const typesForBudget = useMemo(
    () => purchaseTypes.filter((t) => t.budget_id === budgetId),
    [purchaseTypes, budgetId]
  );

  // In edit mode, an existing type that isn't in the list still shows selected.
  const knownChoices = useMemo(() => {
    const names = new Set(["General", ...typesForBudget.map((t) => t.name)]);
    if (typeChoice !== NEW_TYPE && !names.has(typeChoice)) names.add(typeChoice);
    return [...names];
  }, [typesForBudget, typeChoice]);

  function onBudgetChange(id: string) {
    setBudgetId(id);
    setTypeChoice("General");
    setNewTypeName("");
  }

  async function resolvePurchaseType(supabase: ReturnType<typeof createClient>, userId: string) {
    let purchaseType = typeChoice === NEW_TYPE ? newTypeName.trim() : typeChoice;
    if (typeChoice === NEW_TYPE) {
      if (!purchaseType) throw new Error("Enter a name for the new purchase type.");
      const { error: typeError } = await supabase.from("purchase_types").upsert(
        {
          user_id: userId,
          budget_id: budgetId,
          name: purchaseType,
          color: colorForName(purchaseType),
        },
        { onConflict: "budget_id,name" }
      );
      if (typeError) throw new Error(typeError.message);
    }
    return purchaseType;
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

    let purchaseType: string;
    try {
      purchaseType = await resolvePurchaseType(supabase, user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save purchase type.");
      setSaving(false);
      return;
    }

    const payload = {
      budget_id: budgetId,
      amount: Number(amount),
      name: name || null,
      purchase_type: purchaseType,
      occurred_on: occurredOn,
      occurred_time: occurredTime ? `${occurredTime}:00` : null,
    };

    const { error } = isEdit
      ? await supabase.from("expenses").update(payload).eq("id", expense!.id)
      : await supabase.from("expenses").insert({ ...payload, user_id: user.id });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (onClose) onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!expense) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    setDeleting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (onClose) onClose();
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
          {knownChoices.map((t) => (
            <option key={t} value={t} className="text-black">
              {t}
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
        <input
          type="time"
          value={occurredTime}
          onChange={(e) => setOccurredTime(e.target.value)}
          className="rounded border px-2 py-1.5 dark:[color-scheme:dark]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary px-3 py-2">
          {saving ? "Saving..." : isEdit ? "Save Purchase" : "Log Purchase"}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded border border-red-600 px-3 py-2 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="rounded border px-3 py-2 text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
