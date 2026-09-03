"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { colorForName } from "@/lib/finance/calculations";
import type { Budget, PurchaseType } from "@/types/finance";

const EMOJI_CHOICES = ["💰", "🍔", "🏠", "🚗", "🎮", "✈️", "🛒", "💊", "🎓", "🐾", "👕", "📱", "🎁", "⚡", "📺", "🍿"];

interface TypeDraft {
  id?: string; // present for existing rows being edited
  name: string;
  color: string;
  deleted?: boolean;
}

/**
 * Create or edit a budget: name, monthly limit, emoji, and an optional list of
 * purchase types (each with a colour). Used for both the add modal and inline edit.
 */
export default function BudgetForm({
  budget,
  existingTypes,
  onClose,
  availableCashFlow,
}: {
  budget?: Budget; // when set, we're editing
  existingTypes?: PurchaseType[];
  onClose?: () => void;
  availableCashFlow?: number; // used to resolve a percentage limit
}) {
  const router = useRouter();
  const [name, setName] = useState(budget?.name ?? "");
  const [limit, setLimit] = useState(
    budget?.limit_percent != null ? String(budget.limit_percent) : budget ? String(budget.monthly_limit) : ""
  );
  const [limitMode, setLimitMode] = useState<"dollars" | "percent">(
    budget?.limit_percent != null ? "percent" : "dollars"
  );
  const [showLimitInfo, setShowLimitInfo] = useState(false);
  const [emoji, setEmoji] = useState(budget?.emoji ?? "");
  const [types, setTypes] = useState<TypeDraft[]>(
    (existingTypes ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addType() {
    setTypes([...types, { name: "", color: colorForName(`type-${types.length}-${Date.now()}`) }]);
  }

  function updateType(index: number, field: keyof TypeDraft, value: string) {
    const next = [...types];
    next[index] = { ...next[index], [field]: value };
    setTypes(next);
  }

  function removeType(index: number) {
    const next = [...types];
    if (next[index].id) next[index] = { ...next[index], deleted: true };
    else next.splice(index, 1);
    setTypes(next);
  }

  const activeTypes = types.filter((t) => !t.deleted);

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

    // Validate type names (non-empty, unique).
    const names = activeTypes.map((t) => t.name.trim());
    if (names.some((n) => !n)) {
      setError("Purchase types need a name (or remove the empty rows).");
      setSaving(false);
      return;
    }
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
      setError("Purchase type names must be unique within a budget.");
      setSaving(false);
      return;
    }

    // Resolve the limit: dollars as entered, or a percentage of available cash flow.
    // When a percentage is used we also persist it so editing keeps the % value.
    let monthlyLimit: number;
    let limitPercent: number | null = null;
    if (limitMode === "percent") {
      const pct = Number(limit);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        setError("Enter a percentage between 0 and 100.");
        setSaving(false);
        return;
      }
      if (availableCashFlow === undefined) {
        setError("Available cash flow is unknown, so a percentage limit can't be resolved.");
        setSaving(false);
        return;
      }
      limitPercent = pct;
      monthlyLimit = Math.round(availableCashFlow * (pct / 100) * 100) / 100;
    } else {
      monthlyLimit = Number(limit);
    }

    let budgetId = budget?.id;

    if (budget) {
      const { error: updateError } = await supabase
        .from("budgets")
        .update({
          name,
          monthly_limit: monthlyLimit,
          limit_percent: limitPercent,
          emoji: emoji || null,
        })
        .eq("id", budget.id);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: created, error: insertError } = await supabase
        .from("budgets")
        .insert({
          user_id: user.id,
          name,
          monthly_limit: monthlyLimit,
          limit_percent: limitPercent,
          emoji: emoji || null,
        })
        .select("id")
        .single();
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      budgetId = created.id;
    }

    // Delete removed types, then upsert the rest.
    const deletedIds = types.filter((t) => t.deleted && t.id).map((t) => t.id as string);
    if (deletedIds.length > 0) {
      await supabase.from("purchase_types").delete().in("id", deletedIds);
    }

    if (activeTypes.length > 0) {
      const { error: typeError } = await supabase.from("purchase_types").upsert(
        activeTypes.map((t) => ({
          ...(t.id ? { id: t.id } : {}),
          user_id: user.id,
          budget_id: budgetId,
          name: t.name.trim(),
          color: t.color || colorForName(t.name),
        })),
        { onConflict: "budget_id,name" }
      );
      if (typeError) {
        setError(typeError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    if (onClose) onClose();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Budget name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border px-2 py-1.5"
        />
        <div className="flex items-center gap-1">
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-2 text-sm text-gray-500">
              {limitMode === "dollars" ? "$" : "%"}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={limitMode === "percent" ? 100 : undefined}
              placeholder={limitMode === "dollars" ? "Monthly limit" : "Percent of cash flow"}
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className={`w-36 rounded border py-1.5 pr-2 ${limitMode === "dollars" ? "pl-5" : "pl-6"}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setLimitMode((m) => (m === "dollars" ? "percent" : "dollars"))}
            title="Toggle between dollars and percentage of available cash flow"
            className="rounded border px-2 py-1.5 text-xs"
          >
            {limitMode === "dollars" ? "$ → %" : "% → $"}
          </button>
          <button
            type="button"
            onClick={() => setShowLimitInfo((v) => !v)}
            aria-label="About the monthly limit"
            aria-expanded={showLimitInfo}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-[10px] leading-none text-gray-500 hover:text-black dark:hover:text-white"
          >
            i
          </button>
        </div>
      </div>

      {showLimitInfo && (
        <div className="rounded border bg-neutral-50 p-2 text-xs text-gray-600 dark:bg-neutral-900 dark:text-gray-300">
          <p>
            The monthly limit can be a fixed dollar amount, or a percentage of your{" "}
            <strong>available cash flow</strong> (income − payments). A percentage is converted to
            dollars using your current cash flow when you save.
          </p>
          <p className="mt-1">
            A common guide is the <strong>50/30/20 rule</strong>: ~50% needs (housing, groceries,
            bills), ~30% wants (dining, entertainment), ~20% savings/debt. Another is the{" "}
            <strong>60/20/20</strong> split (60% essentials, 20% discretionary, 20% goals). Use
            these as starting points and adjust to your situation.
          </p>
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-300">
          Emoji (optional)
        </span>
        <div className="flex flex-wrap gap-1">
          {EMOJI_CHOICES.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(emoji === em ? "" : em)}
              className={`rounded border px-2 py-1 text-lg leading-none ${
                emoji === em ? "border-black bg-neutral-200 dark:border-white dark:bg-neutral-700" : ""
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Purchase Types (optional)
          </span>
          <button type="button" onClick={addType} className="rounded border px-2 py-0.5 text-xs">
            + Add type
          </button>
        </div>
        <p className="text-xs text-gray-500">
          e.x. for a &quot;Food&quot; budget, add &quot;Groceries&quot;, &quot;Fast Food&quot;, etc.
          Leave empty to use the default &quot;General&quot; type.
        </p>
        {activeTypes.map((t) => {
          const index = types.indexOf(t);
          return (
            <div key={index} className="flex items-center gap-2">
              <input
                type="color"
                value={t.color}
                onChange={(e) => updateType(index, "color", e.target.value)}
                title="Pick a colour"
                className="h-8 w-10 shrink-0 cursor-pointer rounded border p-0.5"
              />
              <input
                type="text"
                placeholder="Type name"
                value={t.name}
                onChange={(e) => updateType(index, "name", e.target.value)}
                className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeType(index)}
                aria-label="Remove type"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary px-3 py-2">
          {saving ? "Saving..." : budget ? "Save Budget" : "Add Budget"}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded border px-3 py-2 text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
