import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Account, Category, Transaction } from "@/types/finance";
import SignOutButton from "./sign-out-button";
import TransactionForm from "./transaction-form";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: accounts }, { data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase
      .from("transactions")
      .select("*")
      .order("occurred_on", { ascending: false })
      .limit(25),
  ]);

  const accountList = (accounts ?? []) as Account[];
  const categoryList = (categories ?? []) as Category[];
  const transactionList = (transactions ?? []) as Transaction[];

  const balances = accountList.map((account) => {
    const total = transactionList
      .filter((t) => t.account_id === account.id)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { account, balance: Number(account.starting_balance) + total };
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Finances</h1>
        <SignOutButton />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Accounts</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-gray-500">
            No accounts yet. Add one directly in Supabase or via the accounts table for now.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {balances.map(({ account, balance }) => (
              <li key={account.id} className="flex justify-between rounded border px-3 py-2">
                <span>{account.name}</span>
                <span className={balance < 0 ? "text-red-600" : ""}>${balance.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Add Transaction</h2>
        <TransactionForm accounts={accountList} categories={categoryList} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Recent Transactions</h2>
        {transactionList.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {transactionList.map((t) => (
              <li key={t.id} className="flex justify-between rounded border px-3 py-2 text-sm">
                <span>
                  {t.occurred_on} — {t.description || "(no description)"}
                </span>
                <span className={Number(t.amount) < 0 ? "text-red-600" : "text-green-600"}>
                  {Number(t.amount) >= 0 ? "+" : ""}
                  {Number(t.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
