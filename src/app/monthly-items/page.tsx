import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionBox } from "@/components/section-box";
import { formatCurrency } from "@/lib/finance/calculations";
import type {
  IncomeHistory,
  IncomeItem,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";
import AddMonthlyItemToggle from "./add-item-toggle";
import MonthlyItemsTable from "./monthly-items-table";
import MonthlyItemListItem from "./monthly-item-list-item";
import HiddenMonthlyItems from "./hidden-items";

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

  const allIncome = (incomeItems ?? []) as IncomeItem[];
  const incomeHist = (incomeHistory ?? []) as IncomeHistory[];
  const allSubs = (subscriptions ?? []) as Subscription[];
  const subHist = (subscriptionHistory ?? []) as SubscriptionHistory[];

  const incomeList = allIncome.filter((i) => !i.hidden);
  const subList = allSubs.filter((s) => !s.hidden);
  const hiddenIncome = allIncome.filter((i) => i.hidden);
  const hiddenSubs = allSubs.filter((s) => s.hidden);

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
              table="income_items"
              historyTable="income_history"
              historyFk="income_id"
              allHistory={incomeHist}
            />
            <HiddenMonthlyItems items={hiddenIncome} table="income_items" />
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
              table="subscriptions"
              historyTable="subscription_history"
              historyFk="subscription_id"
              allHistory={subHist}
              negative
            />
            <HiddenMonthlyItems items={hiddenSubs} table="subscriptions" />
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
  table,
  historyTable,
  historyFk,
  allHistory,
  negative,
}: {
  items: (IncomeItem | Subscription)[];
  emptyText: string;
  table: "income_items" | "subscriptions";
  historyTable: "income_history" | "subscription_history";
  historyFk: "income_id" | "subscription_id";
  allHistory: (IncomeHistory | SubscriptionHistory)[];
  negative?: boolean;
}) {
  if (items.length === 0) {
    return <p className="py-1 text-sm text-gray-500">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 py-1">
      {items.map((item) => {
        const key = table === "income_items" ? "income_id" : "subscription_id";
        const entries = allHistory
          .filter((h) => (h as unknown as Record<string, string>)[key] === item.id)
          .map((h) => ({ id: h.id, month: h.month, amount: Number(h.amount) }));
        return (
          <MonthlyItemListItem
            key={item.id}
            item={item}
            history={entries}
            table={table}
            historyTable={historyTable}
            historyFk={historyFk}
            negative={negative}
          />
        );
      })}
    </ul>
  );
}
