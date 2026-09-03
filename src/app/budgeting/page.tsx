import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionBox } from "@/components/section-box";
import {
  budgetSpend,
  currentMonth,
  formatCurrency,
  monthLabel,
} from "@/lib/finance/calculations";
import type { Budget, Expense } from "@/types/finance";
import BudgetForm from "./budget-form";
import ExpenseForm from "./expense-form";

export default async function BudgetingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const month = currentMonth();

  const [{ data: budgets }, { data: expenses }] = await Promise.all([
    supabase.from("budgets").select("*").order("name"),
    supabase.from("expenses").select("*").order("occurred_on", { ascending: false }),
  ]);

  const budgetList = (budgets ?? []) as Budget[];
  const expenseList = (expenses ?? []) as Expense[];
  const rows = budgetSpend(month, budgetList, expenseList);
  const totalLimit = budgetList.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const recent = expenseList.slice(0, 20);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Budgeting — {monthLabel(month)}</h1>

      <SectionBox title="Budgets" total={totalLimit}>
        {rows.length === 0 ? (
          <p className="py-1 text-sm text-gray-500">No budgets yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 py-1">
            {rows.map(({ budget, spent }) => {
              const over = spent > Number(budget.monthly_limit);
              const pct =
                Number(budget.monthly_limit) > 0
                  ? Math.min(100, (spent / Number(budget.monthly_limit)) * 100)
                  : 0;
              return (
                <li key={budget.id} className="rounded border px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span>{budget.name}</span>
                    <span className={over ? "font-semibold text-red-600" : ""}>
                      {formatCurrency(spent)} / {formatCurrency(Number(budget.monthly_limit))}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-gray-100">
                    <div
                      className={`h-2 rounded ${over ? "bg-red-500" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2 border-t pt-2">
          <BudgetForm />
        </div>
      </SectionBox>

      <section className="rounded border">
        <h2 className="border-b px-4 py-2 text-lg font-medium">Log a Purchase</h2>
        <div className="p-4">
          <ExpenseForm budgets={budgetList} />
        </div>
      </section>

      <section className="rounded border">
        <h2 className="border-b px-4 py-2 text-lg font-medium">Recent Purchases</h2>
        {recent.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">No purchases logged yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {recent.map((e) => {
              const budget = budgetList.find((b) => b.id === e.budget_id);
              return (
                <li key={e.id} className="flex justify-between px-4 py-2">
                  <span>
                    {e.occurred_on} — {e.name || "(unnamed)"}
                    {budget && <span className="text-gray-500"> · {budget.name}</span>}
                    {e.purchase_type && (
                      <span className="text-gray-400"> · {e.purchase_type}</span>
                    )}
                  </span>
                  <span className="text-red-600">{formatCurrency(Number(e.amount))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
