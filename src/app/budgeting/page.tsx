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
import { PurchaseSelectionProvider } from "./purchase-selection";

export default async function BudgetingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const month = currentMonth();

  const [{ data: budgets }, { data: expenses }, { data: purchaseTypes }, { data: incomeItems }, { data: incomeHistory }, { data: subscriptions }, { data: subscriptionHistory }] =
    await Promise.all([
      supabase.from("budgets").select("*").order("name"),
      supabase
        .from("expenses")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("occurred_time", { ascending: false }),
      supabase.from("purchase_types").select("*").order("created_at"),
      supabase.from("income_items").select("*"),
      supabase.from("income_history").select("*"),
      supabase.from("subscriptions").select("*"),
      supabase.from("subscription_history").select("*"),
    ]);

  const budgetList = (budgets ?? []) as Budget[];
  const expenseList = (expenses ?? []) as Expense[];
  const typeList = (purchaseTypes ?? []) as PurchaseType[];
  const rows = budgetSpend(month, budgetList, expenseList);
  const totalLimit = budgetList.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const recent = expenseList; // RecentPurchases limits to 10 itself

  // Available cash flow this month = income - payments.
  const incomeList = (incomeItems ?? []).filter((i) => !(i as { hidden?: boolean }).hidden);
  const paymentList = (subscriptions ?? []).filter((s) => !(s as { hidden?: boolean }).hidden);
  const incomeTotal = incomeList.reduce((sum, i) => sum + Number((i as { amount: number }).amount), 0);
  const paymentTotal = paymentList.reduce((sum, s) => sum + Number((s as { amount: number }).amount), 0);
  const availableCashFlow = incomeTotal - paymentTotal;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Budgeting — {monthLabel(month)}</h1>

      <div className="rounded border border-black p-3 text-center dark:border-white">
        <p className="text-xs uppercase text-gray-500">Available Monthly Cash Flow</p>
        <p className="text-xs text-gray-500">(Income − Payments)</p>
        <p className={`text-2xl font-bold ${availableCashFlow < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(availableCashFlow)}
        </p>
      </div>

      <section className="relative rounded border">
        <CardAddToggle title="Add Budget">
          <BudgetForm availableCashFlow={availableCashFlow} />
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
                  availableCashFlow={availableCashFlow}
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
        <PurchaseSelectionProvider budgets={budgetList} purchaseTypes={typeList} expenses={recent}>
          <RecentPurchases expenses={recent} budgets={budgetList} purchaseTypes={typeList} />
        </PurchaseSelectionProvider>
      </section>
    </main>
  );
}
