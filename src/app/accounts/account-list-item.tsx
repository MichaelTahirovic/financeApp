"use client";

import { useState } from "react";
import {
  effectiveMonthlyAmount,
  formatCurrency,
  monthlyChange,
} from "@/lib/finance/calculations";
import type { AccountHistory, FlowAccount } from "@/types/finance";
import AccountEditForm from "./account-edit-form";

/**
 * One account row with its monthly change tracker and an inline Edit toggle.
 */
export default function AccountListItem({
  account,
  history,
  payable,
  now,
}: {
  account: FlowAccount;
  history: AccountHistory[];
  payable?: boolean;
  now: string;
}) {
  const [editing, setEditing] = useState(false);

  const entries = history.filter((h) => h.account_id === account.id);
  const monthly = effectiveMonthlyAmount(account);
  // For payable accounts the delta is negated so that increasing debt reads negative.
  const change = monthlyChange(account, history, now) * (payable ? -1 : 1);

  return (
    <li className="rounded border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {account.name}
          {payable && account.is_annual_subscription && (
            <span className="ml-1 text-xs text-gray-500">
              (annual {formatCurrency(Number(account.annual_amount ?? 0))} →{" "}
              {formatCurrency(monthly)}/mo)
            </span>
          )}
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
