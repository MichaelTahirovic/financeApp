import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/finance/calculations";
import { ensureMonthlyRollover } from "@/lib/finance/rollover-server";
import type {
  AccountHistory,
  Budget,
  Expense,
  FlowAccount,
  IncomeHistory,
  IncomeItem,
  PurchaseType,
  Subscription,
  SubscriptionHistory,
} from "@/types/finance";
import SandboxClient, { type SandboxData } from "./sandbox-client";

export default async function SandboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = currentMonth();

  let liveData: SandboxData = {
    accounts: [],
    accountHistory: [],
    incomeItems: [],
    incomeHistory: [],
    subscriptions: [],
    subscriptionHistory: [],
    budgets: [],
    purchaseTypes: [],
    expenses: [],
  };

  if (user) {
    await ensureMonthlyRollover(supabase, user);

    const [
      { data: accounts },
      { data: accountHistory },
      { data: incomeItems },
      { data: incomeHistory },
      { data: subscriptions },
      { data: subscriptionHistory },
      { data: budgets },
      { data: purchaseTypes },
      { data: expenses },
    ] = await Promise.all([
      supabase.from("flow_accounts").select("*").order("created_at"),
      supabase.from("account_history").select("*").order("month", { ascending: false }),
      supabase.from("income_items").select("*").order("created_at"),
      supabase.from("income_history").select("*").order("month", { ascending: false }),
      supabase.from("subscriptions").select("*").order("created_at"),
      supabase.from("subscription_history").select("*").order("month", { ascending: false }),
      supabase.from("budgets").select("*").order("name"),
      supabase.from("purchase_types").select("*").order("created_at"),
      supabase
        .from("expenses")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("occurred_time", { ascending: false }),
    ]);

    liveData = {
      accounts: (accounts ?? []) as FlowAccount[],
      accountHistory: (accountHistory ?? []) as AccountHistory[],
      incomeItems: (incomeItems ?? []) as IncomeItem[],
      incomeHistory: (incomeHistory ?? []) as IncomeHistory[],
      subscriptions: (subscriptions ?? []) as Subscription[],
      subscriptionHistory: (subscriptionHistory ?? []) as SubscriptionHistory[],
      budgets: (budgets ?? []) as Budget[],
      purchaseTypes: (purchaseTypes ?? []) as PurchaseType[],
      expenses: (expenses ?? []) as Expense[],
    };
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-4 text-sm text-gray-500">Loading sandbox…</div>}>
      <SandboxClient initialLiveData={liveData} realCurrentMonth={now} />
    </Suspense>
  );
}

