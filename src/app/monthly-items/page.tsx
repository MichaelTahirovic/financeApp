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
import SortableItemList from "./sortable-item-list";
import HiddenMonthlyItems from "./hidden-items";
import { ItemSortProvider } from "./item-sort";

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
  const allPayments = (subscriptions ?? []) as Subscription[];
  const paymentHist = (subscriptionHistory ?? []) as SubscriptionHistory[];

  const incomeList = allIncome.filter((i) => !i.hidden);
  const paymentList = allPayments.filter((s) => !s.hidden);
  const hiddenIncome = allIncome.filter((i) => i.hidden);
  const hiddenPayments = allPayments.filter((s) => s.hidden);

  const incomeTotal = incomeList.reduce((sum, i) => sum + Number(i.amount), 0);
  const paymentTotal = paymentList.reduce((sum, s) => sum + Number(s.amount), 0);
  const cashFlow = incomeTotal - paymentTotal;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Monthly Items</h1>

      <div className="rounded border border-black p-3 text-center dark:border-white">
        <p className="text-xs uppercase text-gray-500">
          Available Cash Flow (Income − Payments)
        </p>
        <p className={`text-2xl font-bold ${cashFlow < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(cashFlow)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <ItemSortProvider>
            <AddMonthlyItemToggle
              title="Income"
              table="income_items"
              historyTable="income_history"
              historyFk="income_id"
            />
            <SectionBox title="Income" total={incomeTotal}>
              <SortableItemList
                items={incomeList}
                emptyText="No income items yet."
                table="income_items"
                historyTable="income_history"
                historyFk="income_id"
                allHistory={incomeHist}
              />
              <HiddenMonthlyItems items={hiddenIncome} table="income_items" />
            </SectionBox>
          </ItemSortProvider>
        </div>

        <div className="relative">
          <ItemSortProvider>
            <AddMonthlyItemToggle
              title="Payment"
              table="subscriptions"
              historyTable="subscription_history"
              historyFk="subscription_id"
              recurringDefault
            />
            <SectionBox title="Payments" total={paymentTotal}>
              <SortableItemList
                items={paymentList}
                emptyText="No payments yet."
                table="subscriptions"
                historyTable="subscription_history"
                historyFk="subscription_id"
                allHistory={paymentHist}
                negative
              />
              <HiddenMonthlyItems items={hiddenPayments} table="subscriptions" />
            </SectionBox>
          </ItemSortProvider>
        </div>
      </div>

      <MonthlyItemsTable
        incomeItems={incomeList}
        incomeHistory={incomeHist}
        subscriptions={paymentList}
        subscriptionHistory={paymentHist}
      />
    </main>
  );
}
