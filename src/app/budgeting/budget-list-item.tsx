"use client";

import { useState } from "react";
import { budgetSpendByType, formatCurrency } from "@/lib/finance/calculations";
import type { Budget, Expense, PurchaseType } from "@/types/finance";
import BudgetForm from "./budget-form";

/**
 * One budget row: emoji + name, spent/limit, a segmented colour-coded progress
 * bar (one coloured segment per purchase type), and an Edit toggle.
 */
export default function BudgetListItem({
  budget,
  spent,
  expenses,
  types,
  month,
  readonly = false,
  availableCashFlow,
}: {
  budget: Budget;
  spent: number;
  expenses: Expense[];
  types: PurchaseType[];
  month: string;
  readonly?: boolean;
  availableCashFlow?: number;
}) {
  const [editing, setEditing] = useState(false);

  const limit = Number(budget.monthly_limit);
  const over = spent > limit;
  const typeSpends = budgetSpendByType(month, budget, expenses, types);
  const budgetTypes = types.filter((t) => t.budget_id === budget.id);

  return (
    <li className="rounded border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {budget.emoji && <span>{budget.emoji}</span>}
          <span className="font-bold text-foreground">{budget.name}</span>
          {!readonly && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded border px-2 py-0.5 text-xs"
            >
              {editing ? "Close" : "Edit"}
            </button>
          )}
        </span>
        <span className={over ? "shrink-0 font-semibold text-red-600" : "shrink-0"}>
          {formatCurrency(spent)} / {formatCurrency(limit)}
          {budget.limit_percent != null && (
            <span className="text-gray-500"> ({budget.limit_percent}%)</span>
          )}
        </span>
      </div>

      <div className="mt-1 flex h-3 overflow-hidden rounded bg-gray-100 dark:bg-neutral-800">
        {limit > 0 && spent === 0 ? null : typeSpends.length === 0 ? (
          <div
            className={`h-3 ${over ? "bg-red-500" : "bg-green-500"}`}
            style={{ width: `${Math.min(100, (spent / Math.max(limit, 1)) * 100)}%` }}
          />
        ) : (
          typeSpends.map((t) => {
            const pct = Math.min(100, (t.spent / Math.max(limit, 1)) * 100);
            return (
              <div
                key={t.name}
                title={`${t.name}: ${formatCurrency(t.spent)}`}
                className="h-3"
                style={{ width: `${pct}%`, backgroundColor: t.color }}
              />
            );
          })
        )}
      </div>
      {typeSpends.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {typeSpends.map((t) => (
            <span key={t.name} className="flex items-center gap-1 text-xs text-gray-500">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: t.color }}
              />
              {t.name}
            </span>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-2 border-t pt-2">
          <BudgetForm
            budget={budget}
            existingTypes={budgetTypes}
            onClose={() => setEditing(false)}
            availableCashFlow={availableCashFlow}
          />
        </div>
      )}
    </li>
  );
}
