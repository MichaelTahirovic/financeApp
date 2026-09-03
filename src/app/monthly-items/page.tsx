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
import AddMonthlyItemToggle from "./add-item-toggle";
import MonthlyItemsTable from "./monthly-items-table";

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
  const cashFlow = incomeTotal - subTotal;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Monthly Items</h1>

      <div className="rounded border border-black p-3 text-center dark:border-white">
        <p className="text-xs uppercase text-gray-500">
          Available Cash Flow (Income − Subscriptions)
        </p>
        <p className={`text-2xl font-bold ${cashFlow < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(cashFlow)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <AddMonthlyItemToggle
            title="Income"
            table="income_items"
            historyTable="income_history"
            historyFk="income_id"
          />
          <SectionBox title="Income" total={incomeTotal}>
            <ItemList
              items={incomeList}
              emptyText="No income items yet."
              historyOf={(id) => incomeHist.filter((h) => h.income_id === id)}
            />
          </SectionBox>
        </div>

        <div className="relative">
          <AddMonthlyItemToggle
            title="Subscription"
            table="subscriptions"
            historyTable="subscription_history"
            historyFk="subscription_id"
            recurringDefault
          />
          <SectionBox title="Subscriptions" total={subTotal}>
            <ItemList
              items={subList}
              emptyText="No subscriptions yet."
              historyOf={(id) => subHist.filter((h) => h.subscription_id === id)}
              negative
            />
          </SectionBox>
        </div>
      </div>

      <MonthlyItemsTable
        incomeItems={incomeList}
        incomeHistory={incomeHist}
        subscriptions={subList}
        subscriptionHistory={subHist}
      />
    </main>
  );
}

function ItemList({
  items,
  emptyText,
  historyOf,
  negative,
}: {
  items: (IncomeItem | Subscription)[];
  emptyText: string;
  historyOf: (id: string) => { id: string; month: string; amount: number }[];
  negative?: boolean;
}) {
  if (items.length === 0) {
    return <p className="py-1 text-sm text-gray-500">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 py-1">
      {items.map((item) => (
        <li key={item.id} className="rounded border px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span>
              {item.name}
              {item.is_recurring && (
                <span className="ml-1 text-xs text-gray-500">(recurring)</span>
              )}
            </span>
            <span className={negative ? "text-red-600" : ""}>
              {formatCurrency(Number(item.amount))}
            </span>
          </div>
          <HistoryList entries={historyOf(item.id)} />
        </li>
      ))}
    </ul>
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
