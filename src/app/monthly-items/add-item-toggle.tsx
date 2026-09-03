"use client";

import { useState } from "react";
import MonthlyItemForm from "./monthly-item-form";

/**
 * "+" button pinned to a card's top-right corner that opens that card's
 * add-item form as a floating modal over a translucent backdrop.
 */
export default function AddMonthlyItemToggle({
  title,
  table,
  historyTable,
  historyFk,
  recurringDefault,
}: {
  title: string;
  table: "income_items" | "subscriptions";
  historyTable: "income_history" | "subscription_history";
  historyFk: "income_id" | "subscription_id";
  recurringDefault?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? `Close add ${title} form` : `Add ${title}`}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-lg leading-none text-white dark:bg-white dark:text-black"
      >
        {open ? "×" : "+"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <section
            className="w-full max-w-md rounded border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="border-b px-4 py-2 text-lg font-medium">Add {title}</h2>
            <div className="p-4">
              <MonthlyItemForm
                table={table}
                historyTable={historyTable}
                historyFk={historyFk}
                recurringDefault={recurringDefault}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
