"use client";

import { useState, type ReactNode } from "react";

/**
 * "+" button pinned to a card's top-right corner that opens the given form
 * content as a floating modal over a translucent backdrop.
 */
export default function CardAddToggle({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? `Close ${title}` : title}
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
            <h2 className="border-b px-4 py-2 text-lg font-medium">{title}</h2>
            <div className="p-4">{children}</div>
          </section>
        </div>
      )}
    </>
  );
}
