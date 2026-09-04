import type { ReactNode } from "react";

/**
 * Split-screen auth layout: branded left panel (Moneywatch title, description,
 * money/ledger background image) with the form on the right.
 */
export default function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel: top on mobile, left on desktop */}
      <div
        className="relative flex flex-col justify-center bg-cover bg-center p-6 text-white md:flex-1 md:p-10"
        style={{ backgroundImage: "url(/auth-bg.svg)" }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative">
          <h1 className="ledger text-4xl font-bold md:text-5xl">Moneywatch</h1>
          <p className="mt-2 max-w-md text-sm text-white/90 md:mt-4 md:text-lg">
            A private, cross-platform finance tracker. Keep an eye on your accounts,
            monthly income and payments, budgets, and spending — all in one ledger.
          </p>
        </div>
      </div>

      {/* Form: below on mobile (top-aligned), right on desktop (centered) */}
      <div className="flex flex-1 items-start justify-center p-6 pt-4 md:items-center md:p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
