import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  budgetSpend,
  currentMonth,
  formatCurrency,
  monthlyNetWorthDifference,
  monthlyRevenue,
  monthlySpend,
  monthLabel,
  netWorth,
} from "@/lib/finance/calculations";
import type {
  Budget,
  Expense,
  FlowAccount,
  IncomeHistory,
  IncomeItem,
  PurchaseType,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";
import BudgetListItem from "./budgeting/budget-list-item";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const month = currentMonth();

  const [
    { data: accounts },
    { data: budgets },
    { data: expenses },
    { data: incomeItems },
    { data: incomeHistory },
    { data: subscriptions },
    { data: subscriptionHistory },
    { data: purchaseTypes },
  ] = await Promise.all([
    supabase.from("flow_accounts").select("*"),
    supabase.from("budgets").select("*").order("name"),
    supabase.from("expenses").select("*"),
    supabase.from("income_items").select("*"),
    supabase.from("income_history").select("*"),
    supabase.from("subscriptions").select("*"),
    supabase.from("subscription_history").select("*"),
    supabase.from("purchase_types").select("*"),
  ]);

  const accountList = (accounts ?? []) as FlowAccount[];
  const budgetList = (budgets ?? []) as Budget[];
  const expenseList = (expenses ?? []) as Expense[];
  const incomeList = (incomeItems ?? []) as IncomeItem[];
  const incomeHist = (incomeHistory ?? []) as IncomeHistory[];
  const subList = (subscriptions ?? []) as Subscription[];
  const subHist = (subscriptionHistory ?? []) as SubscriptionHistory[];
  const typeList = (purchaseTypes ?? []) as PurchaseType[];

  const spend = monthlySpend(month, expenseList, subList, subHist);
  const revenue = monthlyRevenue(month, incomeList, incomeHist);
  const worth = netWorth(accountList);
  const difference = monthlyNetWorthDifference(
    month,
    expenseList,
    subList,
    subHist,
    incomeList,
    incomeHist
  );
  const budgetRows = budgetSpend(month, budgetList, expenseList);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Overview — {monthLabel(month)}</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Net Worth" value={worth} highlight />
        <StatCard label="Monthly Revenue" value={revenue} positive />
        <StatCard
          label="Net Worth Change (this month)"
          value={difference}
          negative={difference < 0}
        />
        <StatCard label="Monthly Spend" value={-spend} negative />
      </div>

      <section className="rounded border">
        <h2 className="border-b px-4 py-2 text-lg font-medium">Budgets this month</h2>
        {budgetRows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">
            No budgets yet — create some on the Budgeting page.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 px-4 py-2">
            {budgetRows.map(({ budget, spent }) => (
              <BudgetListItem
                key={budget.id}
                budget={budget}
                spent={spent}
                expenses={expenseList}
                types={typeList}
                month={month}
                readonly
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  highlight,
  negative,
  positive,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  negative?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded border p-3 ${highlight ? "border-black dark:border-white" : ""} ${
        negative ? "text-red-600" : positive ? "text-green-600" : ""
      }`}
    >
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-xl font-bold">{formatCurrency(value)}</p>
    </div>
  );
}
