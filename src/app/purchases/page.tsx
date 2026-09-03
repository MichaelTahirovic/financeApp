import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { monthLabel } from "@/lib/finance/calculations";
import type { Budget, Expense, PurchaseType } from "@/types/finance";
import { PurchaseRow } from "../budgeting/recent-purchases";
import { PurchaseSelectionProvider } from "../budgeting/purchase-selection";

/**
 * All purchases, grouped by month with sticky month/year section headers that
 * stay pinned to the top of the screen while scrolling that month's purchases.
 */
export default async function PurchasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: expenses }, { data: budgets }, { data: purchaseTypes }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("occurred_on", { ascending: false })
      .order("occurred_time", { ascending: false }),
    supabase.from("budgets").select("*").order("name"),
    supabase.from("purchase_types").select("*").order("created_at"),
  ]);

  const expenseList = (expenses ?? []) as Expense[];
  const budgetList = (budgets ?? []) as Budget[];
  const typeList = (purchaseTypes ?? []) as PurchaseType[];

  // Group by month (YYYY-MM), newest first.
  const byMonth = new Map<string, Expense[]>();
  for (const e of expenseList) {
    const key = e.occurred_on.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/budgeting" className="rounded border px-3 py-1 text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">All Purchases</h1>
      </div>

      {expenseList.length === 0 ? (
        <p className="text-sm text-gray-500">No purchases logged yet.</p>
      ) : (
        <PurchaseSelectionProvider budgets={budgetList} purchaseTypes={typeList}>
          {months.map((month) => (
            <section key={month} className="rounded border">
              <h2 className="sticky top-14 z-10 border-b bg-background px-4 py-2 text-lg font-medium">
                {monthLabel(month)}
              </h2>
              <ul className="divide-y text-sm">
                {byMonth.get(month)!.map((e) => (
                  <PurchaseRow
                    key={e.id}
                    expense={e}
                    budgets={budgetList}
                    purchaseTypes={typeList}
                  />
                ))}
              </ul>
            </section>
          ))}
        </PurchaseSelectionProvider>
      )}
    </main>
  );
}
