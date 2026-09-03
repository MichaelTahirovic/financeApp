"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Budget, Expense, PurchaseType } from "@/types/finance";

interface SelectionState {
  selected: Set<string>;
  toggle: (id: string) => void;
  deselectAll: () => void;
}

const SelectionContext = createContext<SelectionState>({
  selected: new Set(),
  toggle: () => {},
  deselectAll: () => {},
});

export function usePurchaseSelection() {
  return useContext(SelectionContext);
}

/**
 * Holds the set of selected purchase ids for a purchases view and renders the
 * floating bulk-action bar when anything is selected.
 */
export function PurchaseSelectionProvider({
  budgets,
  purchaseTypes,
  expenses,
  children,
}: {
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
  expenses: Expense[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const state = useMemo<SelectionState>(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      deselectAll: () => setSelected(new Set()),
    }),
    [selected]
  );

  // The distinct budgets the selected entries belong to. Used to scope the
  // purchase-type dropdown and to disable it when the selection spans budgets.
  const selectedBudgetIds = useMemo(() => {
    const ids = new Set(
      expenses.filter((e) => selected.has(e.id)).map((e) => e.budget_id)
    );
    return [...ids];
  }, [expenses, selected]);

  return (
    <SelectionContext.Provider value={state}>
      {children}
      {selected.size > 0 && (
        <BulkActionBar
          budgets={budgets}
          purchaseTypes={purchaseTypes}
          selectedBudgetIds={selectedBudgetIds}
        />
      )}
    </SelectionContext.Provider>
  );
}

function BulkActionBar({
  budgets,
  purchaseTypes,
  selectedBudgetIds,
}: {
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
  selectedBudgetIds: string[];
}) {
  const router = useRouter();
  const { selected, deselectAll } = usePurchaseSelection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingBudget, setChangingBudget] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const [targetBudget, setTargetBudget] = useState(budgets[0]?.id ?? "");
  const [targetType, setTargetType] = useState("General");

  const ids = [...selected];

  // Change Purchase Type only applies when every selected entry shares one budget;
  // the type dropdown then shows that budget's types.
  const singleBudget = selectedBudgetIds.length === 1 ? selectedBudgetIds[0] : null;
  const typesForSelectedBudget = singleBudget
    ? purchaseTypes.filter((t) => t.budget_id === singleBudget)
    : [];

  async function run(update: Record<string, unknown>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("expenses").update(update).in("id", ids);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    deselectAll();
    setChangingBudget(false);
    setChangingType(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${ids.length} selected purchase${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().in("id", ids);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    deselectAll();
    router.refresh();
  }

  return (
    <div className="fixed inset-x-0 top-14 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-2xl flex-col gap-2 rounded border bg-background p-3 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{ids.length} selected</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded border border-red-600 px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => { setChangingBudget((v) => !v); setChangingType(false); }}
            className="rounded border px-2 py-1"
          >
            Change Budget
          </button>
          <button
            type="button"
            onClick={() => { if (singleBudget) { setChangingType((v) => !v); setChangingBudget(false); } }}
            disabled={!singleBudget}
            title={
              singleBudget
                ? "Change the purchase type of the selected entries"
                : "Select entries from a single budget to change purchase type"
            }
            className="rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Change Purchase Type
          </button>
          <button type="button" onClick={deselectAll} className="rounded border px-2 py-1">
            Deselect All
          </button>
        </div>

        {changingBudget && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={targetBudget}
              onChange={(e) => setTargetBudget(e.target.value)}
              className="rounded border bg-white px-2 py-1 text-black"
            >
              {budgets.map((b) => (
                <option key={b.id} value={b.id} className="text-black">
                  {b.emoji ? `${b.emoji} ` : ""}{b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !targetBudget}
              onClick={() => run({ budget_id: targetBudget })}
              className="btn-primary px-3 py-1 text-xs"
            >
              Apply to {ids.length}
            </button>
          </div>
        )}

        {changingType && singleBudget && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="rounded border bg-white px-2 py-1 text-black"
            >
              <option value="General" className="text-black">General</option>
              {typesForSelectedBudget.map((t) => (
                <option key={t.id} value={t.name} className="text-black">
                  {t.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              (types of {budgets.find((b) => b.id === singleBudget)?.name ?? "the selected budget"})
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ purchase_type: targetType })}
              className="btn-primary px-3 py-1 text-xs"
            >
              Apply to {ids.length}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
