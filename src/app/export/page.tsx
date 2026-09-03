import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import ExportClient from "./export-client";

export interface ExportData {
  accounts: FlowAccount[];
  accountHistory: AccountHistory[];
  incomeItems: IncomeItem[];
  incomeHistory: IncomeHistory[];
  subscriptions: Subscription[];
  subscriptionHistory: SubscriptionHistory[];
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
  expenses: Expense[];
  /** Expenses from the current month only (for PDF/print). */
  currentMonthExpenses: Expense[];
  currentMonth: string;
}

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    supabase.from("flow_accounts").select("*"),
    supabase.from("account_history").select("*"),
    supabase.from("income_items").select("*"),
    supabase.from("income_history").select("*"),
    supabase.from("subscriptions").select("*"),
    supabase.from("subscription_history").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("purchase_types").select("*"),
    supabase
      .from("expenses")
      .select("*")
      .order("occurred_on", { ascending: false })
      .order("occurred_time", { ascending: false }),
  ]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const allExpenses = (expenses ?? []) as Expense[];

  const data: ExportData = {
    accounts: (accounts ?? []) as FlowAccount[],
    accountHistory: (accountHistory ?? []) as AccountHistory[],
    incomeItems: (incomeItems ?? []) as IncomeItem[],
    incomeHistory: (incomeHistory ?? []) as IncomeHistory[],
    subscriptions: (subscriptions ?? []) as Subscription[],
    subscriptionHistory: (subscriptionHistory ?? []) as SubscriptionHistory[],
    budgets: (budgets ?? []) as Budget[],
    purchaseTypes: (purchaseTypes ?? []) as PurchaseType[],
    expenses: allExpenses,
    currentMonthExpenses: allExpenses.filter((e) => e.occurred_on.slice(0, 7) === currentMonth),
    currentMonth,
  };

  return <ExportClient data={data} />;
}
