import type { ReactNode } from "react";

/**
 * Split-screen auth layout: branded left panel (Moneywatch title, description,
 * money/ledger background image) with the form on the right.
 */
export default function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div
        className="relative hidden flex-1 flex-col justify-center bg-cover bg-center p-10 text-white md:flex"
        style={{ backgroundImage: "url(/auth-bg.svg)" }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative">
          <h1 className="ledger text-5xl font-bold">Moneywatch</h1>
          <p className="mt-4 max-w-md text-lg text-white/90">
            A private, cross-platform finance tracker. Keep an eye on your accounts,
            monthly income and payments, budgets, and spending — all in one ledger.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
