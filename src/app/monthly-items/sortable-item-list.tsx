"use client";

import type { IncomeHistory, IncomeItem, Subscription, SubscriptionHistory } from "@/types/finance";
import { useItemSort } from "./item-sort";
import MonthlyItemListItem from "./monthly-item-list-item";

type Item = IncomeItem | Subscription;

/**
 * Renders a card's items sorted per the card's sort filter (default / high→low / low→high).
 */
export default function SortableItemList({
  items,
  emptyText,
  table,
  historyTable,
  historyFk,
  allHistory,
  negative,
}: {
  items: Item[];
  emptyText: string;
  table: "income_items" | "subscriptions";
  historyTable: "income_history" | "subscription_history";
  historyFk: "income_id" | "subscription_id";
  allHistory: (IncomeHistory | SubscriptionHistory)[];
  negative?: boolean;
}) {
  const { mode } = useItemSort();

  const sorted = [...items];
  if (mode === "desc") sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
  else if (mode === "asc") sorted.sort((a, b) => Number(a.amount) - Number(b.amount));
  // "default" keeps creation order (items already arrive in created_at order).

  if (sorted.length === 0) {
    return <p className="py-1 text-sm text-gray-500">{emptyText}</p>;
  }

  const key = table === "income_items" ? "income_id" : "subscription_id";

  return (
    <ul className="flex flex-col gap-2 py-1">
      {sorted.map((item) => {
        const entries = allHistory
          .filter((h) => (h as unknown as Record<string, string>)[key] === item.id)
          .map((h) => ({ id: h.id, month: h.month, amount: Number(h.amount) }));
        return (
          <MonthlyItemListItem
            key={item.id}
            item={item}
            history={entries}
            table={table}
            historyTable={historyTable}
            historyFk={historyFk}
            negative={negative}
          />
        );
      })}
    </ul>
  );
}
