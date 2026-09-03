import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionBox } from "@/components/section-box";
import {
  effectiveMonthlyAmount,
  formatCurrency,
  monthLabel,
  netWorth,
  payableTotal,
  receivableTotal,
} from "@/lib/finance/calculations";
import type { AccountHistory, FlowAccount } from "@/types/finance";
import AccountForm from "./account-form";

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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
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

      <section className="rounded border">
        <h2 className="border-b px-4 py-2 text-lg font-medium">Add Account</h2>
        <div className="p-4">
          <AccountForm />
        </div>
      </section>
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
      {accounts.map((a) => {
        const entries = history.filter((h) => h.account_id === a.id);
        const monthly = effectiveMonthlyAmount(a);
        return (
          <li key={a.id} className="rounded border px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span>
                {a.name}
                {payable && a.is_annual_subscription && (
                  <span className="ml-1 text-xs text-gray-500">
                    (annual {formatCurrency(Number(a.annual_amount ?? 0))} →{" "}
                    {formatCurrency(monthly)}/mo)
                  </span>
                )}
              </span>
              <span className={payable ? "text-red-600" : ""}>
                {formatCurrency(payable ? monthly : Number(a.amount))}
              </span>
            </div>
            {entries.length > 0 && (
              <ul className="mt-1 text-xs text-gray-500">
                {entries.map((h) => (
                  <li key={h.id} className="flex justify-between">
                    <span>{monthLabel(h.month.slice(0, 7))}</span>
                    <span>{formatCurrency(Number(h.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
