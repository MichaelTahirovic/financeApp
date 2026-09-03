import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionBox } from "@/components/section-box";
import {
  formatCurrency,
  netWorth,
  payableTotal,
  receivableTotal,
} from "@/lib/finance/calculations";
import type { AccountHistory, FlowAccount } from "@/types/finance";
import AccountListItem from "./account-list-item";
import AccountHistoryTable from "./account-history-table";
import AddAccountToggle from "./add-account-toggle";

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: accounts }, { data: history }] = await Promise.all([
    supabase.from("flow_accounts").select("*").order("created_at"),
    supabase.from("account_history").select("*").order("month", { ascending: false }),
  ]);

  const accountList = (accounts ?? []) as FlowAccount[];
  const historyList = (history ?? []) as AccountHistory[];

  const receivables = accountList.filter((a) => a.kind === "receivable");
  const payables = accountList.filter((a) => a.kind === "payable");

  const worth = netWorth(accountList);

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <AddAccountToggle />

      <h1 className="text-2xl font-semibold">Accounts</h1>

      <div className="rounded border border-black p-3 text-center">
        <p className="text-xs uppercase text-gray-500">
          Net Worth (Receivable − Payable)
        </p>
        <p className={`text-2xl font-bold ${worth < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(worth)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionBox title="Accounts Receivable" total={receivableTotal(accountList)}>
          <AccountList accounts={receivables} history={historyList} />
        </SectionBox>

        <SectionBox title="Accounts Payable" total={payableTotal(accountList)}>
          <AccountList accounts={payables} history={historyList} payable />
        </SectionBox>
      </div>

      <AccountHistoryTable accounts={accountList} history={historyList} />
    </main>
  );
}

function AccountList({
  accounts,
  history,
  payable,
}: {
  accounts: FlowAccount[];
  history: AccountHistory[];
  payable?: boolean;
}) {
  if (accounts.length === 0) {
    return <p className="py-1 text-sm text-gray-500">None yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 py-1">
      {accounts.map((a) => (
        <AccountListItem key={a.id} account={a} history={history} payable={payable} />
      ))}
    </ul>
  );
}
