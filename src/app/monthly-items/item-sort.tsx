"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type SortMode = "default" | "desc" | "asc";

const SortContext = createContext<{
  mode: SortMode;
  cycle: () => void;
}>({ mode: "default", cycle: () => {} });

export function useItemSort() {
  return useContext(SortContext);
}

/**
 * Provides sort-mode state for one Monthly Items card.
 */
export function ItemSortProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SortMode>("default");

  function cycle() {
    setMode((m) => (m === "default" ? "desc" : m === "desc" ? "asc" : "default"));
  }

  return <SortContext.Provider value={{ mode, cycle }}>{children}</SortContext.Provider>;
}

/**
 * The card's sort filter button — renders in the card header (left of the add +).
 */
export function ItemSortButton() {
  const { mode, cycle } = useItemSort();
  const label =
    mode === "desc" ? "High to low" : mode === "asc" ? "Low to high" : "Default order";
  const icon = mode === "desc" ? "▼" : mode === "asc" ? "▲" : "⇅";
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Sort: ${label}`}
      title={`Sort: ${label}`}
      className="flex h-7 w-7 items-center justify-center rounded-full border text-sm"
    >
      {icon}
    </button>
  );
}
