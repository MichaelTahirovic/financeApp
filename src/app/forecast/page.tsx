import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  forecastNextMonth,
  formatCurrency,
  monthlySpend,
  monthLabel,
} from "@/lib/finance/calculations";
import type { Expense, Subscription, SubscriptionHistory } from "@/types/finance";

export default async function ForecastPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: expenses }, { data: subscriptions }, { data: subscriptionHistory }] =
    await Promise.all([
      supabase.from("expenses").select("*"),
      supabase.from("subscriptions").select("*"),
      supabase.from("subscription_history").select("*"),
    ]);

  const expenseList = (expenses ?? []) as Expense[];
  const subList = (subscriptions ?? []) as Subscription[];
  const subHist = (subscriptionHistory ?? []) as SubscriptionHistory[];

  const forecast = forecastNextMonth(expenseList, subList, subHist);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Forecast</h1>

      <div className="rounded border border-black p-4 text-center">
        <p className="text-xs uppercase text-gray-500">
          Estimated spend for {monthLabel(forecast.targetMonth)}
        </p>
        <p className="text-3xl font-bold">{formatCurrency(forecast.estimate)}</p>
        <p className="mt-1 text-xs text-gray-500">
          {forecast.usedFallback
            ? "Based on last month's spending (fewer than 3 months of history available)"
            : "Based on the average of your last 3 months of spending"}
        </p>
      </div>

      <section className="rounded border">
        <h2 className="border-b px-4 py-2 text-lg font-medium">Months used</h2>
        <ul className="divide-y text-sm">
          {forecast.monthsUsed.map((m) => (
            <li key={m} className="flex justify-between px-4 py-2">
              <span>{monthLabel(m)}</span>
              <span>
                {formatCurrency(monthlySpend(m, expenseList, subList, subHist))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
