"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance/calculations";
import type { IncomeItem, Subscription } from "@/types/finance";
import MonthlyItemEditForm from "./monthly-item-edit-form";

type Item = IncomeItem | Subscription;

/**
 * One income/subscription row with an inline Edit toggle and a quick Hide button.
 */
export default function MonthlyItemListItem({
  item,
  history,
  table,
  historyTable,
  historyFk,
  negative,
}: {
  item: Item;
  history: { id: string; month: string; amount: number }[];
  table: "income_items" | "subscriptions";
  historyTable: "income_history" | "subscription_history";
  historyFk: "income_id" | "subscription_id";
  negative?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function quickHide() {
    const supabase = createClient();
    await supabase.from(table).update({ hidden: true }).eq("id", item.id);
    router.refresh();
  }

  return (
    <li className="rounded border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {item.name}
          {item.is_recurring && (
            <span className="ml-1 text-xs text-gray-500">(recurring)</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={negative ? "text-red-600" : ""}>
            {formatCurrency(Number(item.amount))}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border px-2 py-0.5 text-xs"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            onClick={quickHide}
            aria-label="Hide item"
            title="Hide"
            className="rounded border px-2 py-0.5 text-xs text-gray-500 hover:text-black dark:hover:text-white"
          >
            Hide
          </button>
        </span>
      </div>
      {editing && (
        <MonthlyItemEditForm
          item={item}
          history={history}
          table={table}
          historyTable={historyTable}
          historyFk={historyFk}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}
