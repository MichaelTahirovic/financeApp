"use client";

import { useState } from "react";
import AccountForm from "./account-form";

/**
 * "+" button (top-right of the Accounts page content) that opens the Add Account
 * form as a floating modal over a grey translucent backdrop.
 */
export default function AddAccountToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close add account form" : "Add account"}
        className="fixed right-4 top-16 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-black text-2xl leading-none text-white shadow-lg dark:bg-white dark:text-black"
      >
        {open ? "×" : "+"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <section
            className="w-full max-w-lg rounded border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="border-b px-4 py-2 text-lg font-medium">Add Account</h2>
            <div className="p-4">
              <AccountForm />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
