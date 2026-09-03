"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/finance/calculations";
import type { Budget, Expense, PurchaseType } from "@/types/finance";
import ExpenseForm from "./expense-form";
import { usePurchaseSelection } from "./purchase-selection";

const PREVIEW_COUNT = 10;

/**
 * Recent purchases preview (last 10). A footer link opens the full purchases
 * page. Each row: emoji, "PurchaseName - Budget . PurchaseType (Date HH:MM)",
 * with Edit (and delete via the edit form) per entry.
 */
export default function RecentPurchases({
  expenses,
  budgets,
  purchaseTypes,
}: {
  expenses: Expense[];
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
}) {
  if (expenses.length === 0) {
    return <p className="px-4 py-3 text-sm text-gray-500">No purchases logged yet.</p>;
  }
  const shown = expenses.slice(0, PREVIEW_COUNT);
  const hasMore = expenses.length > PREVIEW_COUNT;

  return (
    <>
      <ul className="divide-y text-sm">
        {shown.map((e) => (
          <PurchaseRow key={e.id} expense={e} budgets={budgets} purchaseTypes={purchaseTypes} />
        ))}
      </ul>
      {hasMore && (
        <div className="border-t px-4 py-2 text-center">
          <Link href="/purchases" className="text-sm underline">
            Show all {expenses.length} purchases
          </Link>
        </div>
      )}
    </>
  );
}

export function PurchaseRow({
  expense,
  budgets,
  purchaseTypes,
}: {
  expense: Expense;
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
}) {
  const [editing, setEditing] = useState(false);
  const { selected, toggle } = usePurchaseSelection();
  const budget = budgets.find((b) => b.id === expense.budget_id);
  const time = expense.occurred_time ? expense.occurred_time.slice(0, 5) : null;

  return (
    <li className="px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {budget?.emoji && <span className="mr-1">{budget.emoji}</span>}
          <span className="font-bold text-foreground">{expense.name || "(unnamed)"}</span>
          <span className="text-foreground"> - {budget ? budget.name : "Undefined"}</span>
          {expense.purchase_type && (
            <span className="text-gray-500"> • {expense.purchase_type}</span>
          )}
          <span className="text-gray-400">
            {" "}({expense.occurred_on}
            {time ? ` ${time}` : ""})
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-red-600">{formatCurrency(Number(expense.amount))}</span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border px-2 py-0.5 text-xs"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <input
            type="checkbox"
            checked={selected.has(expense.id)}
            onChange={() => toggle(expense.id)}
            aria-label="Select purchase"
            className="h-4 w-4 cursor-pointer"
          />
        </span>
      </div>
      {editing && (
        <div className="mt-2 border-t pt-2">
          <ExpenseForm
            budgets={budgets}
            purchaseTypes={purchaseTypes}
            expense={expense}
            onClose={() => setEditing(false)}
          />
        </div>
      )}
    </li>
  );
}
