import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionBox } from "@/components/section-box";
import { formatCurrency, monthLabel } from "@/lib/finance/calculations";
import type {
  IncomeHistory,
  IncomeItem,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";
import MonthlyItemForm from "./monthly-item-form";

export default async function MonthlyItemsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: incomeItems },
    { data: incomeHistory },
    { data: subscriptions },
    { data: subscriptionHistory },
  ] = await Promise.all([
    supabase.from("income_items").select("*").order("created_at"),
    supabase.from("income_history").select("*").order("month", { ascending: false }),
    supabase.from("subscriptions").select("*").order("created_at"),
    supabase.from("subscription_history").select("*").order("month", { ascending: false }),
  ]);

  const incomeList = (incomeItems ?? []) as IncomeItem[];
  const incomeHist = (incomeHistory ?? []) as IncomeHistory[];
  const subList = (subscriptions ?? []) as Subscription[];
  const subHist = (subscriptionHistory ?? []) as SubscriptionHistory[];

  const incomeTotal = incomeList.reduce((sum, i) => sum + Number(i.amount), 0);
  const subTotal = subList.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Monthly Items</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionBox title="Income" total={incomeTotal}>
          <ul className="flex flex-col gap-2 py-1">
            {incomeList.length === 0 && (
              <p className="py-1 text-sm text-gray-500">No income items yet.</p>
            )}
            {incomeList.map((item) => (
              <li key={item.id} className="rounded border px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span>
                    {item.name}
                    {item.is_recurring && (
                      <span className="ml-1 text-xs text-gray-500">(recurring)</span>
                    )}
                  </span>
                  <span>{formatCurrency(Number(item.amount))}</span>
                </div>
                <HistoryList
                  entries={incomeHist.filter((h) => h.income_id === item.id)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t pt-2">
            <MonthlyItemForm table="income_items" historyTable="income_history" historyFk="income_id" />
          </div>
        </SectionBox>

        <SectionBox title="Subscriptions" total={subTotal}>
          <ul className="flex flex-col gap-2 py-1">
            {subList.length === 0 && (
              <p className="py-1 text-sm text-gray-500">No subscriptions yet.</p>
            )}
            {subList.map((sub) => (
              <li key={sub.id} className="rounded border px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span>
                    {sub.name}
                    {sub.is_recurring && (
                      <span className="ml-1 text-xs text-gray-500">(recurring)</span>
                    )}
                  </span>
                  <span className="text-red-600">{formatCurrency(Number(sub.amount))}</span>
                </div>
                <HistoryList
                  entries={subHist.filter((h) => h.subscription_id === sub.id)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t pt-2">
            <MonthlyItemForm
              table="subscriptions"
              historyTable="subscription_history"
              historyFk="subscription_id"
              recurringDefault
            />
          </div>
        </SectionBox>
      </div>
    </main>
  );
}

function HistoryList({ entries }: { entries: { id: string; month: string; amount: number }[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1 text-xs text-gray-500">
      {entries.map((h) => (
        <li key={h.id} className="flex justify-between">
          <span>{monthLabel(h.month.slice(0, 7))}</span>
          <span>{formatCurrency(Number(h.amount))}</span>
        </li>
      ))}
    </ul>
  );
}
