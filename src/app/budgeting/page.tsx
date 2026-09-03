import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  budgetSpend,
  currentMonth,
  formatCurrency,
  monthLabel,
} from "@/lib/finance/calculations";
import type { Budget, Expense, PurchaseType } from "@/types/finance";
import CardAddToggle from "@/components/card-add-toggle";
import BudgetForm from "./budget-form";
import ExpenseForm from "./expense-form";
import BudgetListItem from "./budget-list-item";
import RecentPurchases from "./recent-purchases";

export default async function BudgetingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const month = currentMonth();

  const [{ data: budgets }, { data: expenses }, { data: purchaseTypes }] = await Promise.all([
    supabase.from("budgets").select("*").order("name"),
    supabase.from("expenses").select("*").order("occurred_on", { ascending: false }),
    supabase.from("purchase_types").select("*").order("created_at"),
  ]);

  const budgetList = (budgets ?? []) as Budget[];
  const expenseList = (expenses ?? []) as Expense[];
  const typeList = (purchaseTypes ?? []) as PurchaseType[];
  const rows = budgetSpend(month, budgetList, expenseList);
  const totalLimit = budgetList.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const recent = expenseList.slice(0, 20);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Budgeting — {monthLabel(month)}</h1>

      <section className="relative rounded border">
        <CardAddToggle title="Add Budget">
          <BudgetForm />
        </CardAddToggle>
        <h2 className="border-b px-4 py-2 text-lg font-medium">Budgets</h2>
        <div className="px-4 py-2">
          {rows.length === 0 ? (
            <p className="py-1 text-sm text-gray-500">No budgets yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 py-1">
              {rows.map(({ budget, spent }) => (
                <BudgetListItem
                  key={budget.id}
                  budget={budget}
                  spent={spent}
                  expenses={expenseList}
                  types={typeList}
                  month={month}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-between border-t px-4 py-2 font-bold">
          <span>Total</span>
          <span>{formatCurrency(totalLimit)}</span>
        </div>
      </section>

      <section className="relative rounded border">
        <CardAddToggle title="Log a Purchase">
          <ExpenseForm budgets={budgetList} purchaseTypes={typeList} />
        </CardAddToggle>
        <h2 className="border-b px-4 py-2 text-lg font-medium">Recent Purchases</h2>
        <RecentPurchases expenses={recent} budgets={budgetList} purchaseTypes={typeList} />
      </section>
    </main>
  );
}
