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
import type { Budget, PurchaseType } from "@/types/finance";

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
  children,
}: {
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
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

  return (
    <SelectionContext.Provider value={state}>
      {children}
      {selected.size > 0 && (
        <BulkActionBar budgets={budgets} purchaseTypes={purchaseTypes} />
      )}
    </SelectionContext.Provider>
  );
}

function BulkActionBar({
  budgets,
  purchaseTypes,
}: {
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
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
  const typesForTarget = purchaseTypes.filter((t) => t.budget_id === targetBudget);

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
            onClick={() => { setChangingType((v) => !v); setChangingBudget(false); }}
            className="rounded border px-2 py-1"
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

        {changingType && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="rounded border bg-white px-2 py-1 text-black"
            >
              <option value="General" className="text-black">General</option>
              {typesForTarget.map((t) => (
                <option key={t.id} value={t.name} className="text-black">
                  {t.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">(types of the chosen budget)</span>
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
