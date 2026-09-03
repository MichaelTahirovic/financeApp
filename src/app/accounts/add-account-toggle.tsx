"use client";

import { useState } from "react";
import AccountForm from "./account-form";

/**
 * "+" button (top-right of the Accounts page content) that reveals the Add Account form.
 */
export default function AddAccountToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close add account form" : "Add account"}
        className="fixed right-4 top-16 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black text-2xl leading-none text-white shadow-lg"
      >
        {open ? "×" : "+"}
      </button>
      {open && (
        <section className="rounded border">
          <h2 className="border-b px-4 py-2 text-lg font-medium">Add Account</h2>
          <div className="p-4">
            <AccountForm />
          </div>
        </section>
      )}
    </>
  );
}
