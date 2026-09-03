"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  effectiveMonthlyAmount,
  formatCurrency,
  monthlyChange,
} from "@/lib/finance/calculations";
import type { AccountHistory, FlowAccount } from "@/types/finance";
import AccountEditForm from "./account-edit-form";

/**
 * One account row with its monthly change tracker, up/down reorder arrows,
 * and an inline Edit toggle. Reordering swaps sort_order with the adjacent
 * account in the same card.
 */
export default function AccountListItem({
  account,
  history,
  payable,
  now,
  siblings,
  index,
}: {
  account: FlowAccount;
  history: AccountHistory[];
  payable?: boolean;
  now: string;
  /** All accounts in this card (same kind), in display order. */
  siblings: FlowAccount[];
  index: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reordering, setReordering] = useState(false);

  const entries = history.filter((h) => h.account_id === account.id);
  const monthly = effectiveMonthlyAmount(account);
  // For payable accounts the delta is negated so that increasing debt reads negative.
  const change = monthlyChange(account, history, now) * (payable ? -1 : 1);

  const isFirst = index === 0;
  const isLast = index === siblings.length - 1;

  async function move(direction: -1 | 1) {
    const neighbor = siblings[index + direction];
    if (!neighbor) return;
    setReordering(true);

    const supabase = createClient();
    // Swap sort_order values so the two accounts trade places.
    const myOrder = account.sort_order ?? index + 1;
    const neighborOrder = neighbor.sort_order ?? index + direction + 1;

    await supabase.from("flow_accounts").update({ sort_order: neighborOrder }).eq("id", account.id);
    await supabase.from("flow_accounts").update({ sort_order: myOrder }).eq("id", neighbor.id);

    setReordering(false);
    router.refresh();
  }

  return (
    <li className="rounded border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          <span className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={isFirst || reordering}
              aria-label="Move up"
              className="leading-none text-gray-500 hover:text-black disabled:opacity-20 dark:hover:text-white"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={isLast || reordering}
              aria-label="Move down"
              className="leading-none text-gray-500 hover:text-black disabled:opacity-20 dark:hover:text-white"
            >
              ▼
            </button>
          </span>
          <span className="min-w-0">
            {account.name}
            {payable && account.is_annual_subscription && (
              <span className="ml-1 text-xs text-gray-500">
                (annual {formatCurrency(Number(account.annual_amount ?? 0))} →{" "}
                {formatCurrency(monthly)}/mo)
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`text-xs ${
              change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-400"
            }`}
            title={
              payable
                ? "Monthly change in debt (negative = debt increased)"
                : "Monthly change vs. previous recorded month"
            }
          >
            {change > 0 ? "+" : ""}
            {formatCurrency(change)}
          </span>
          <span className={payable ? "font-medium text-red-600" : "font-medium"}>
            {formatCurrency(payable ? monthly : Number(account.amount))}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border px-2 py-0.5 text-xs"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </span>
      </div>
      {editing && (
        <AccountEditForm account={account} history={entries} onClose={() => setEditing(false)} />
      )}
    </li>
  );
}
