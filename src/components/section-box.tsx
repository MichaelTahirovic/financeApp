import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/finance/calculations";

/**
 * A titled box listing items, with an optional bolded total pinned to the bottom
 * and an optional action area rendered at the right of the header.
 */
export function SectionBox({
  title,
  total,
  headerActions,
  children,
}: {
  title: string;
  total?: number;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card flex flex-col">
      <h2 className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 text-lg font-medium">
        <span className="min-w-0">{title}</span>
        {headerActions && <span className="flex shrink-0 items-center gap-1">{headerActions}</span>}
      </h2>
      <div className="flex-1 px-4 py-2">{children}</div>
      {total !== undefined && (
        <div className="flex justify-between border-t border-line px-4 py-2 font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      )}
    </section>
  );
}
