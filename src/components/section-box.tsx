import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/finance/calculations";

/**
 * A titled box listing items, with an optional bolded total pinned to the bottom.
 */
export function SectionBox({
  title,
  total,
  children,
}: {
  title: string;
  total?: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded border">
      <h2 className="border-b px-4 py-2 text-lg font-medium">{title}</h2>
      <div className="flex-1 px-4 py-2">{children}</div>
      {total !== undefined && (
        <div className="flex justify-between border-t px-4 py-2 font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      )}
    </section>
  );
}
