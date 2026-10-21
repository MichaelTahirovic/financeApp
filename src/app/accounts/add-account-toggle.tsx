"use client";

import { useState } from "react";
import type { FlowAccountKind } from "@/types/finance";
import AccountForm from "./account-form";

/**
 * "+" button pinned to a card's top-right corner that opens that card's
 * add-account form as a floating modal over a translucent backdrop (matching
 * the Income / Payment add buttons on the Monthly Items page).
 */
export default function AddAccountToggle({
  title,
  kind,
}: {
  title: string;
  kind: FlowAccountKind;
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
              <AccountForm
                defaultKind={kind}
                lockedKind
                onSuccess={() => setOpen(false)}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
