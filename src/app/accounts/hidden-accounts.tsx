"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance/calculations";
import type { FlowAccount } from "@/types/finance";

/**
 * "Accounts Hidden (x)" button shown under the last receivable when at least one
 * account is hidden. Clicking reveals the hidden accounts with an Unhide action.
 */
export default function HiddenAccounts({ hidden }: { hidden: FlowAccount[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (hidden.length === 0) return null;

  async function unhide(id: string) {
    const supabase = createClient();
    await supabase.from("flow_accounts").update({ hidden: false }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-dashed px-3 py-1.5 text-sm text-gray-500 hover:text-black dark:hover:text-white"
      >
        Accounts Hidden ({hidden.length}) {open ? "▲" : "▼"}
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {hidden.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-dashed px-3 py-2 text-sm text-gray-500"
            >
              <span>
                {a.name}
                <span className="ml-1 text-xs">
                  ({a.kind === "payable" ? "Payable" : "Receivable"})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span>{formatCurrency(Number(a.amount))}</span>
                <button
                  type="button"
                  onClick={() => unhide(a.id)}
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
