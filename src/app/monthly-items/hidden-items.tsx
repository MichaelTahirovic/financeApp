"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance/calculations";
import type { IncomeItem, Subscription } from "@/types/finance";

type Item = IncomeItem | Subscription;

/**
 * Collapsible list of hidden items for one Monthly Items card, with Unhide.
 * Renders nothing when there are no hidden items.
 */
export default function HiddenMonthlyItems({
  items,
  table,
}: {
  items: Item[];
  table: "income_items" | "subscriptions";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  async function unhide(id: string) {
    const supabase = createClient();
    await supabase.from(table).update({ hidden: false }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-dashed px-3 py-1.5 text-sm text-gray-500 hover:text-black dark:hover:text-white"
      >
        Hidden ({items.length}) {open ? "▲" : "▼"}
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded border border-dashed px-3 py-2 text-sm text-gray-500"
            >
              <span>{item.name}</span>
              <span className="flex items-center gap-2">
                <span>{formatCurrency(Number(item.amount))}</span>
                <button
                  type="button"
                  onClick={() => unhide(item.id)}
                  className="rounded border px-2 py-0.5 text-xs"
                >
                  Unhide
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
