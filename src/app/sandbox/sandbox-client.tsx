"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SectionBox } from "@/components/section-box";
import AccountHistoryTable from "@/app/accounts/account-history-table";
import MonthlyItemsTable from "@/app/monthly-items/monthly-items-table";
import {
  annualAccrual,
  budgetSpend,
  budgetSpendByType,
  bySortOrder,
  colorForName,
  effectiveMonthlyAmount,
  forecastNextMonth,
  formatCurrency,
  monthlyChange,
  monthlyNetWorthDifference,
  monthlyRevenue,
  monthlySpend,
  monthLabel,
  monthsSince,
  netWorth,
  payableTotal,
  receivableTotal,
  shiftMonth,
  visibleAccounts,
} from "@/lib/finance/calculations";
import { applyMonthRollover, type RolloverSummary } from "@/lib/finance/rollover";
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

export interface SandboxData {
  accounts: FlowAccount[];
  accountHistory: AccountHistory[];
  incomeItems: IncomeItem[];
  incomeHistory: IncomeHistory[];
  subscriptions: Subscription[];
  subscriptionHistory: SubscriptionHistory[];
  budgets: Budget[];
  purchaseTypes: PurchaseType[];
  expenses: Expense[];
}

type SandboxTab = "accounts" | "monthly-items" | "budgeting" | "home" | "forecast" | "log";

interface UndoStep {
  simMonth: string;
  data: SandboxData;
  logs: RolloverSummary[];
}

const STORAGE_KEY = "finance-sandbox-state-v1";

function buildDemoData(baseMonth: string): SandboxData {
  const prevMonth = shiftMonth(baseMonth, -1);
  const createdIso = `${prevMonth}-01T00:00:00.000Z`;
  const userId = "sandbox-user";

  const accounts: FlowAccount[] = [
    {
      id: "demo-acc-checking",
      user_id: userId,
      name: "Checking Account",
      kind: "receivable",
      amount: 4250,
      is_annual_subscription: false,
      annual_amount: null,
      hidden: false,
      sort_order: 1,
      created_at: createdIso,
    },
    {
      id: "demo-acc-savings",
      user_id: userId,
      name: "High-Yield Savings",
      kind: "receivable",
      amount: 12500,
      is_annual_subscription: false,
      annual_amount: null,
      hidden: false,
      sort_order: 2,
      created_at: createdIso,
    },
    {
      id: "demo-acc-cc",
      user_id: userId,
      name: "Credit Card Balance",
      kind: "payable",
      amount: 640,
      is_annual_subscription: false,
      annual_amount: null,
      hidden: false,
      sort_order: 1,
      created_at: createdIso,
    },
    {
      id: "demo-acc-annual",
      user_id: userId,
      name: "Cloud Suite (Annual Plan)",
      kind: "payable",
      amount: 20,
      is_annual_subscription: true,
      annual_amount: 240, // accrues $20/mo on rollover
      hidden: false,
      sort_order: 2,
      created_at: createdIso,
    },
  ];

  const accountHistory: AccountHistory[] = [
    {
      id: "demo-ah-1",
      user_id: userId,
      account_id: "demo-acc-checking",
      month: `${prevMonth}-01`,
      amount: 3900,
      created_at: createdIso,
    },
    {
      id: "demo-ah-2",
      user_id: userId,
      account_id: "demo-acc-savings",
      month: `${prevMonth}-01`,
      amount: 12000,
      created_at: createdIso,
    },
    {
      id: "demo-ah-3",
      user_id: userId,
      account_id: "demo-acc-cc",
      month: `${prevMonth}-01`,
      amount: 810,
      created_at: createdIso,
    },
    {
      id: "demo-ah-4",
      user_id: userId,
      account_id: "demo-acc-annual",
      month: `${prevMonth}-01`,
      amount: 0,
      created_at: createdIso,
    },
  ];

  const incomeItems: IncomeItem[] = [
    {
      id: "demo-inc-salary",
      user_id: userId,
      name: "Primary Salary",
      amount: 5200,
      is_recurring: true,
      hidden: false,
      created_at: createdIso,
    },
    {
      id: "demo-inc-bonus",
      user_id: userId,
      name: "One-Time Project Bonus",
      amount: 600,
      is_recurring: false, // resets to $0 on rollover after archiving!
      hidden: false,
      created_at: createdIso,
    },
  ];

  const incomeHistory: IncomeHistory[] = [
    {
      id: "demo-ih-1",
      user_id: userId,
      income_id: "demo-inc-salary",
      month: `${prevMonth}-01`,
      amount: 5200,
      created_at: createdIso,
    },
  ];

  const subscriptions: Subscription[] = [
    {
      id: "demo-sub-rent",
      user_id: userId,
      name: "Apartment Rent",
      amount: 1850,
      is_recurring: true,
      hidden: false,
      created_at: createdIso,
    },
    {
      id: "demo-sub-utilities",
      user_id: userId,
      name: "Internet & Utilities",
      amount: 150,
      is_recurring: true,
      hidden: false,
      created_at: createdIso,
    },
    {
      id: "demo-sub-repair",
      user_id: userId,
      name: "One-Off Car Service",
      amount: 300,
      is_recurring: false, // resets to $0 on rollover after archiving!
      hidden: false,
      created_at: createdIso,
    },
  ];

  const subscriptionHistory: SubscriptionHistory[] = [
    {
      id: "demo-sh-1",
      user_id: userId,
      subscription_id: "demo-sub-rent",
      month: `${prevMonth}-01`,
      amount: 1850,
      created_at: createdIso,
    },
    {
      id: "demo-sh-2",
      user_id: userId,
      subscription_id: "demo-sub-utilities",
      month: `${prevMonth}-01`,
      amount: 145,
      created_at: createdIso,
    },
  ];

  // Available cash flow in baseMonth = (5200 + 600) - (1850 + 150 + 300) = 3500
  // 20% of 3500 = 700
  const budgets: Budget[] = [
    {
      id: "demo-bud-food",
      user_id: userId,
      name: "Food & Dining",
      monthly_limit: 600,
      limit_percent: null,
      emoji: "🍔",
      created_at: createdIso,
    },
    {
      id: "demo-bud-wants",
      user_id: userId,
      name: "Flexible Wants (20% Cash Flow)",
      monthly_limit: 700,
      limit_percent: 20, // recalculates on rollover when cash flow changes!
      emoji: "🎮",
      created_at: createdIso,
    },
  ];

  const purchaseTypes: PurchaseType[] = [
    {
      id: "demo-pt-groceries",
      user_id: userId,
      budget_id: "demo-bud-food",
      name: "Groceries",
      color: "#34d399",
      created_at: createdIso,
    },
    {
      id: "demo-pt-restaurants",
      user_id: userId,
      budget_id: "demo-bud-food",
      name: "Restaurants",
      color: "#60a5fa",
      created_at: createdIso,
    },
  ];

  const expenses: Expense[] = [
    {
      id: "demo-exp-1",
      user_id: userId,
      budget_id: "demo-bud-food",
      amount: 142.5,
      name: "Weekly Groceries",
      purchase_type: "Groceries",
      occurred_on: `${baseMonth}-05`,
      occurred_time: "14:30:00",
      created_at: createdIso,
    },
    {
      id: "demo-exp-2",
      user_id: userId,
      budget_id: "demo-bud-food",
      amount: 64.0,
      name: "Dinner Out",
      purchase_type: "Restaurants",
      occurred_on: `${baseMonth}-12`,
      occurred_time: "19:15:00",
      created_at: createdIso,
    },
    {
      id: "demo-exp-3",
      user_id: userId,
      budget_id: "demo-bud-wants",
      amount: 89.99,
      name: "Concert Tickets",
      purchase_type: "General",
      occurred_on: `${baseMonth}-14`,
      occurred_time: "20:00:00",
      created_at: createdIso,
    },
  ];

  return {
    accounts,
    accountHistory,
    incomeItems,
    incomeHistory,
    subscriptions,
    subscriptionHistory,
    budgets,
    purchaseTypes,
    expenses,
  };
}

function hasAnyData(d: SandboxData): boolean {
  return (
    d.accounts.length > 0 ||
    d.incomeItems.length > 0 ||
    d.subscriptions.length > 0 ||
    d.budgets.length > 0
  );
}

export default function SandboxClient({
  initialLiveData,
  realCurrentMonth,
}: {
  initialLiveData: SandboxData;
  realCurrentMonth: string;
}) {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab") as SandboxTab | null;

  const [tab, setTab] = useState<SandboxTab>(
    initialTabParam &&
      ["accounts", "monthly-items", "budgeting", "home", "forecast", "log"].includes(initialTabParam)
      ? initialTabParam
      : "accounts"
  );

  const defaultDataset = useMemo(
    () => (hasAnyData(initialLiveData) ? initialLiveData : buildDemoData(realCurrentMonth)),
    [initialLiveData, realCurrentMonth]
  );

  const [simMonth, setSimMonth] = useState<string>(realCurrentMonth);
  const [data, setData] = useState<SandboxData>(defaultDataset);
  const [logs, setLogs] = useState<RolloverSummary[]>([]);
  const [undoStack, setUndoStack] = useState<UndoStep[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore saved sandbox session from localStorage if present.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          simMonth?: string;
          data?: SandboxData;
          logs?: RolloverSummary[];
        };
        if (parsed.simMonth && parsed.data) {
          setSimMonth(parsed.simMonth);
          setData(parsed.data);
          setLogs(parsed.logs ?? []);
        }
      }
    } catch {
      // Ignore storage parse issues
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ simMonth, data, logs })
      );
    } catch {
      // Ignore quota errors
    }
  }, [hydrated, simMonth, data, logs]);

  function advanceMonths(count: number) {
    setUndoStack((prev) => [...prev, { simMonth, data, logs }]);

    let cursorMonth = simMonth;
    let cursorData: SandboxData = data;
    const newSummaries: RolloverSummary[] = [];

    for (let i = 0; i < count; i++) {
      const res = applyMonthRollover(cursorData, cursorMonth, {
        respectCreatedAt: false,
        advanceLiveBalances: true,
      });
      cursorData = {
        ...res.nextState,
        purchaseTypes: cursorData.purchaseTypes,
      };
      newSummaries.unshift(res.summary);
      cursorMonth = shiftMonth(cursorMonth, 1);
    }

    setSimMonth(cursorMonth);
    setData(cursorData);
    setLogs((prev) => [...newSummaries, ...prev]);
  }

  function stepBack() {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setSimMonth(last.simMonth);
    setData(last.data);
    setLogs(last.logs);
    setUndoStack((prev) => prev.slice(0, -1));
  }

  function resetToLive() {
    setUndoStack([]);
    setSimMonth(realCurrentMonth);
    setData(hasAnyData(initialLiveData) ? initialLiveData : buildDemoData(realCurrentMonth));
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  function loadDemo() {
    setUndoStack([]);
    setSimMonth(realCurrentMonth);
    setData(buildDemoData(realCurrentMonth));
    setLogs([]);
  }

  const monthsAhead = monthsSince(realCurrentMonth, simMonth);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {/* Sandbox Control Banner */}
      <section className="rounded border-2 border-amber-500/80 bg-amber-50/60 p-4 dark:bg-amber-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold uppercase text-black">
                Sandbox Mode
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Isolated simulation — your real account data is never modified
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold">
              Simulated Month: {monthLabel(simMonth)}
              {monthsAhead !== 0 && (
                <span className="ml-2 text-sm font-normal text-amber-700 dark:text-amber-300">
                  ({monthsAhead > 0 ? `+${monthsAhead}` : monthsAhead} month
                  {Math.abs(monthsAhead) === 1 ? "" : "s"} from today)
                </span>
              )}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => advanceMonths(1)}
              className="btn-primary px-3 py-1.5 text-sm font-medium"
            >
              Simulate Next Month Rollover →
            </button>
            <button
              type="button"
              onClick={() => advanceMonths(3)}
              className="rounded border bg-background px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              +3 Months
            </button>
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={stepBack}
              className="rounded border bg-background px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              ↶ Undo Rollover
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/30 pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-300">
            <span>
              Rollovers simulated: <strong>{logs.length}</strong>
            </span>
            {logs.length > 0 && (
              <span>
                • Latest: {monthLabel(logs[0].completedMonth)} → {monthLabel(logs[0].nextMonth)} (
                {logs[0].accountsArchived.length} accounts,{" "}
                {logs[0].incomeArchived.length + logs[0].paymentsArchived.length} monthly items archived)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDemo}
              className="rounded border bg-background px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Load Sample Data
            </button>
            <button
              type="button"
              onClick={resetToLive}
              className="rounded border bg-background px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Reset to My Live Data
            </button>
          </div>
        </div>
      </section>

      {/* Sandbox Sub-navigation */}
      <div className="flex flex-wrap gap-1 rounded border p-1">
        {(
          [
            { id: "accounts", label: "Accounts" },
            { id: "monthly-items", label: "Monthly Items" },
            { id: "budgeting", label: "Budgeting" },
            { id: "home", label: "Home Overview" },
            { id: "forecast", label: "Forecast" },
            { id: "log", label: `Rollover Log (${logs.length})` },
          ] as { id: SandboxTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <SandboxAccountsTab data={data} setData={setData} simMonth={simMonth} />
      )}
      {tab === "monthly-items" && (
        <SandboxMonthlyItemsTab data={data} setData={setData} simMonth={simMonth} />
      )}
      {tab === "budgeting" && (
        <SandboxBudgetingTab data={data} setData={setData} simMonth={simMonth} />
      )}
      {tab === "home" && <SandboxHomeTab data={data} simMonth={simMonth} />}
      {tab === "forecast" && <SandboxForecastTab data={data} simMonth={simMonth} />}
      {tab === "log" && <SandboxLogTab logs={logs} />}
    </main>
  );
}

// ============================================================================
// TAB 1: ACCOUNTS (SANDBOX)
// ============================================================================
function SandboxAccountsTab({
  data,
  setData,
  simMonth,
}: {
  data: SandboxData;
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
  simMonth: string;
}) {
  const [addingKind, setAddingKind] = useState<"receivable" | "payable" | null>(null);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newIsAnnual, setNewIsAnnual] = useState(false);
  const [newAnnualAmount, setNewAnnualAmount] = useState("");

  const visible = visibleAccounts(data.accounts);
  const hidden = data.accounts.filter((a) => a.hidden);
  const receivables = bySortOrder(visible.filter((a) => a.kind === "receivable"));
  const payables = bySortOrder(visible.filter((a) => a.kind === "payable"));
  const worth = netWorth(visible);

  function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!addingKind || !newName.trim()) return;
    const acc: FlowAccount = {
      id: `sb-acc-${Date.now()}`,
      user_id: "sandbox-user",
      name: newName.trim(),
      kind: addingKind,
      amount: Number(newAmount) || 0,
      is_annual_subscription: addingKind === "payable" && newIsAnnual,
      annual_amount: addingKind === "payable" && newIsAnnual ? Number(newAnnualAmount) || 0 : null,
      hidden: false,
      sort_order: data.accounts.length + 1,
      created_at: `${simMonth}-01T00:00:00.000Z`,
    };
    setData((prev) => ({ ...prev, accounts: [...prev.accounts, acc] }));
    setNewName("");
    setNewAmount("");
    setNewIsAnnual(false);
    setNewAnnualAmount("");
    setAddingKind(null);
  }

  function handleUpdateHistoryCell(account: FlowAccount, month: string, amount: number | null) {
    if (month === simMonth) {
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === account.id ? { ...a, amount: amount ?? 0 } : a
        ),
      }));
      return;
    }

    setData((prev) => {
      const rest = prev.accountHistory.filter(
        (h) => !(h.account_id === account.id && h.month.slice(0, 7) === month)
      );
      if (amount === null) {
        return { ...prev, accountHistory: rest };
      }
      return {
        ...prev,
        accountHistory: [
          {
            id: `sb-ah-${account.id}-${month}`,
            user_id: "sandbox-user",
            account_id: account.id,
            month: `${month}-01`,
            amount,
            created_at: new Date().toISOString(),
          },
          ...rest,
        ],
      };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Accounts — {monthLabel(simMonth)}</h2>

      {addingKind && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24"
          onClick={() => setAddingKind(null)}
        >
          <section
            className="w-full max-w-md rounded border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="border-b px-4 py-2 text-lg font-medium">
              Add {addingKind === "receivable" ? "Account Receivable" : "Account Payable"}
            </h2>
            <form onSubmit={handleAddAccount} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  required
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-28 rounded border px-2 py-1 text-sm"
                />
              </div>
              {addingKind === "payable" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newIsAnnual}
                      onChange={(e) => setNewIsAnnual(e.target.checked)}
                    />
                    Annual Payment?
                  </label>
                  {newIsAnnual && (
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Annual cost"
                      required
                      value={newAnnualAmount}
                      onChange={(e) => setNewAnnualAmount(e.target.value)}
                      className="w-28 rounded border px-2 py-1 text-sm"
                    />
                  )}
                  {newIsAnnual && newAnnualAmount && (
                    <span className="text-xs text-gray-500">
                      accrues {(Number(newAnnualAmount) / 12).toFixed(2)}/month
                    </span>
                  )}
                </div>
              )}
              <button type="submit" className="btn-primary px-3 py-1.5 text-sm">
                Add
              </button>
            </form>
          </section>
        </div>
      )}

      <div className="rounded border border-black p-3 text-center dark:border-white">
        <p className="text-xs uppercase text-gray-500">Net Worth (Receivable − Payable)</p>
        <p className={`text-2xl font-bold ${worth < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(worth)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionBox
          title="Accounts Receivable"
          total={receivableTotal(visible)}
          headerActions={
            <button
              type="button"
              onClick={() => setAddingKind(addingKind === "receivable" ? null : "receivable")}
              aria-label="Add Account Receivable"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-lg leading-none text-white dark:bg-white dark:text-black"
            >
              {addingKind === "receivable" ? "×" : "+"}
            </button>
          }
        >
          <SandboxAccountList
            accounts={receivables}
            history={data.accountHistory}
            simMonth={simMonth}
            setData={setData}
          />
          <SandboxHiddenAccounts
            hidden={hidden.filter((a) => a.kind === "receivable")}
            setData={setData}
          />
        </SectionBox>

        <SectionBox
          title="Accounts Payable"
          total={payableTotal(visible)}
          headerActions={
            <button
              type="button"
              onClick={() => setAddingKind(addingKind === "payable" ? null : "payable")}
              aria-label="Add Account Payable"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-lg leading-none text-white dark:bg-white dark:text-black"
            >
              {addingKind === "payable" ? "×" : "+"}
            </button>
          }
        >
          <SandboxAccountList
            accounts={payables}
            history={data.accountHistory}
            simMonth={simMonth}
            payable
            setData={setData}
          />
          <SandboxHiddenAccounts
            hidden={hidden.filter((a) => a.kind === "payable")}
            setData={setData}
          />
        </SectionBox>
      </div>

      <AccountHistoryTable
        accounts={visible}
        history={data.accountHistory}
        now={simMonth}
        onUpdateCell={handleUpdateHistoryCell}
      />
    </div>
  );
}

function SandboxAccountList({
  accounts,
  history,
  simMonth,
  payable,
  setData,
}: {
  accounts: FlowAccount[];
  history: AccountHistory[];
  simMonth: string;
  payable?: boolean;
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
}) {
  if (accounts.length === 0) {
    return <p className="py-1 text-sm text-gray-500">None yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 py-1">
      {accounts.map((a) => (
        <SandboxAccountRow
          key={a.id}
          account={a}
          history={history.filter((h) => h.account_id === a.id)}
          allHistory={history}
          simMonth={simMonth}
          payable={payable}
          setData={setData}
        />
      ))}
    </ul>
  );
}

function SandboxAccountRow({
  account,
  history,
  allHistory,
  simMonth,
  payable,
  setData,
}: {
  account: FlowAccount;
  history: AccountHistory[];
  allHistory: AccountHistory[];
  simMonth: string;
  payable?: boolean;
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
}) {
  const [editing, setEditing] = useState(false);
  const monthly = effectiveMonthlyAmount(account);
  const accrual = annualAccrual(account);
  const change = monthlyChange(account, allHistory, simMonth) * (payable ? -1 : 1);

  return (
    <li className="rounded border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {account.name}
          {payable && account.is_annual_subscription && (
            <span className="ml-1 text-xs text-gray-500">
              (annual {formatCurrency(Number(account.annual_amount ?? 0))} →{" "}
              {formatCurrency(accrual)}/mo)
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`text-xs ${
              change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-400"
            }`}
          >
            {change > 0 ? "+" : ""}
            {formatCurrency(change)}
          </span>
          <span className={payable ? "font-medium text-red-600" : "font-medium"}>
            {formatCurrency(payable ? monthly : Number(account.amount))}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border px-2 py-0.5 text-xs"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </span>
      </div>

      {editing && (
        <SandboxAccountEditForm
          account={account}
          history={history}
          setData={setData}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function SandboxAccountEditForm({
  account,
  history,
  setData,
  onClose,
}: {
  account: FlowAccount;
  history: AccountHistory[];
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
  onClose: () => void;
}) {
  const sorted = [...history].sort((a, b) => b.month.localeCompare(a.month));
  const [currentValue, setCurrentValue] = useState(String(account.amount));
  const [hidden, setHidden] = useState(account.hidden);
  const [isAnnual, setIsAnnual] = useState(account.is_annual_subscription);
  const [annualAmount, setAnnualAmount] = useState(
    account.annual_amount != null ? String(account.annual_amount) : ""
  );
  const [rows, setRows] = useState<{ month: string; amount: string }[]>(
    sorted.map((h) => ({ month: h.month.slice(0, 7), amount: String(h.amount) }))
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validRows = rows.filter((r) => r.month && r.amount !== "");
    setData((prev) => {
      const otherHistory = prev.accountHistory.filter((h) => h.account_id !== account.id);
      const updatedAccountHistory: AccountHistory[] = validRows.map((r) => ({
        id: `sb-ah-${account.id}-${r.month}`,
        user_id: "sandbox-user",
        account_id: account.id,
        month: `${r.month}-01`,
        amount: Number(r.amount) || 0,
        created_at: new Date().toISOString(),
      }));
      return {
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === account.id
            ? {
                ...a,
                amount: Number(currentValue) || 0,
                hidden,
                is_annual_subscription: account.kind === "payable" && isAnnual,
                annual_amount:
                  account.kind === "payable" && isAnnual ? Number(annualAmount) || 0 : null,
              }
            : a
        ),
        accountHistory: [...updatedAccountHistory, ...otherHistory],
      };
    });
    onClose();
  }

  function handleDelete() {
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== account.id),
      accountHistory: prev.accountHistory.filter((h) => h.account_id !== account.id),
    }));
    onClose();
  }

  return (
    <form onSubmit={handleSave} className="mt-2 flex flex-col gap-2 border-t pt-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32 text-gray-600">Current value</span>
        <input
          type="number"
          step="0.01"
          required
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="w-32 rounded border px-2 py-1"
        />
      </label>

      {account.kind === "payable" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAnnual}
              onChange={(e) => setIsAnnual(e.target.checked)}
            />
            Annual Payment?
          </label>
          {isAnnual && (
            <input
              type="number"
              step="0.01"
              placeholder="Annual cost"
              required
              value={annualAmount}
              onChange={(e) => setAnnualAmount(e.target.value)}
              className="w-32 rounded border px-2 py-1"
            />
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
        />
        Hide
      </label>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">
            Previous months (auto-rolled over &amp; editable)
          </span>
          <button
            type="button"
            onClick={() => setRows([...rows, { month: "", amount: "" }])}
            className="rounded border px-2 py-0.5 text-xs"
          >
            + Add month
          </button>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              type="month"
              value={row.month}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], month: e.target.value };
                setRows(next);
              }}
              className="min-w-0 flex-1 rounded border px-2 py-0.5 text-xs dark:[color-scheme:dark]"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={row.amount}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], amount: e.target.value };
                setRows(next);
              }}
              className="w-24 min-w-0 rounded border px-2 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary px-3 py-1 text-xs">
          Save
        </button>
        <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-xs">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="ml-auto rounded border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600 hover:text-white"
        >
          Delete
        </button>
      </div>
    </form>
  );
}

function SandboxHiddenAccounts({
  hidden,
  setData,
}: {
  hidden: FlowAccount[];
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
}) {
  const [open, setOpen] = useState(false);
  if (hidden.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-dashed px-3 py-1.5 text-sm text-gray-500"
      >
        Accounts Hidden ({hidden.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {hidden.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-dashed px-3 py-2 text-sm text-gray-500"
            >
              <span>{a.name}</span>
              <span className="flex items-center gap-2">
                <span>{formatCurrency(Number(a.amount))}</span>
                <button
                  type="button"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      accounts: prev.accounts.map((x) =>
                        x.id === a.id ? { ...x, hidden: false } : x
                      ),
                    }))
                  }
                  className="rounded border px-2 py-0.5 text-xs"
                >
                  Unhide
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// TAB 2: MONTHLY ITEMS (SANDBOX)
// ============================================================================
function SandboxMonthlyItemsTab({
  data,
  setData,
  simMonth,
}: {
  data: SandboxData;
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
  simMonth: string;
}) {
  const [addingKind, setAddingKind] = useState<"income" | "subscription" | null>(null);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newRecurring, setNewRecurring] = useState(true);

  const visibleIncome = data.incomeItems.filter((i) => !i.hidden);
  const visibleSubs = data.subscriptions.filter((s) => !s.hidden);
  const incomeTotal = visibleIncome.reduce((sum, i) => sum + Number(i.amount), 0);
  const paymentTotal = visibleSubs.reduce((sum, s) => sum + Number(s.amount), 0);
  const cashFlow = incomeTotal - paymentTotal;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addingKind || !newName.trim()) return;
    const createdIso = `${simMonth}-01T00:00:00.000Z`;
    if (addingKind === "income") {
      const item: IncomeItem = {
        id: `sb-inc-${Date.now()}`,
        user_id: "sandbox-user",
        name: newName.trim(),
        amount: Number(newAmount) || 0,
        is_recurring: newRecurring,
        hidden: false,
        created_at: createdIso,
      };
      setData((prev) => ({ ...prev, incomeItems: [...prev.incomeItems, item] }));
    } else {
      const sub: Subscription = {
        id: `sb-sub-${Date.now()}`,
        user_id: "sandbox-user",
        name: newName.trim(),
        amount: Number(newAmount) || 0,
        is_recurring: newRecurring,
        hidden: false,
        created_at: createdIso,
      };
      setData((prev) => ({ ...prev, subscriptions: [...prev.subscriptions, sub] }));
    }
    setNewName("");
    setNewAmount("");
    setAddingKind(null);
  }

  function handleUpdateCell(
    kind: "income" | "subscription",
    itemId: string,
    month: string,
    amount: number | null
  ) {
    if (month === simMonth) {
      if (kind === "income") {
        setData((prev) => ({
          ...prev,
          incomeItems: prev.incomeItems.map((i) =>
            i.id === itemId ? { ...i, amount: amount ?? 0 } : i
          ),
        }));
      } else {
        setData((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((s) =>
            s.id === itemId ? { ...s, amount: amount ?? 0 } : s
          ),
        }));
      }
      return;
    }

    if (kind === "income") {
      setData((prev) => {
        const rest = prev.incomeHistory.filter(
          (h) => !(h.income_id === itemId && h.month.slice(0, 7) === month)
        );
        if (amount === null) return { ...prev, incomeHistory: rest };
        return {
          ...prev,
          incomeHistory: [
            {
              id: `sb-ih-${itemId}-${month}`,
              user_id: "sandbox-user",
              income_id: itemId,
              month: `${month}-01`,
              amount,
              created_at: new Date().toISOString(),
            },
            ...rest,
          ],
        };
      });
    } else {
      setData((prev) => {
        const rest = prev.subscriptionHistory.filter(
          (h) => !(h.subscription_id === itemId && h.month.slice(0, 7) === month)
        );
        if (amount === null) return { ...prev, subscriptionHistory: rest };
        return {
          ...prev,
          subscriptionHistory: [
            {
              id: `sb-sh-${itemId}-${month}`,
              user_id: "sandbox-user",
              subscription_id: itemId,
              month: `${month}-01`,
              amount,
              created_at: new Date().toISOString(),
            },
            ...rest,
          ],
        };
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Monthly Items — {monthLabel(simMonth)}</h2>

      {addingKind && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24"
          onClick={() => setAddingKind(null)}
        >
          <section
            className="w-full max-w-md rounded border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="border-b px-4 py-2 text-lg font-medium">
              Add {addingKind === "income" ? "Income" : "Payment"}
            </h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  required
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-28 rounded border px-2 py-1 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRecurring}
                  onChange={(e) => setNewRecurring(e.target.checked)}
                />
                Recur every month
              </label>
              <button type="submit" className="btn-primary px-3 py-1.5 text-sm">
                Add
              </button>
            </form>
          </section>
        </div>
      )}

      <div className="rounded border border-black p-3 text-center dark:border-white">
        <p className="text-xs uppercase text-gray-500">Available Monthly Cash Flow</p>
        <p className="text-xs text-gray-500">(Income − Payments)</p>
        <p className={`text-2xl font-bold ${cashFlow < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(cashFlow)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionBox
          title="Income"
          total={incomeTotal}
          headerActions={
            <button
              type="button"
              onClick={() => {
                setAddingKind(addingKind === "income" ? null : "income");
                setNewRecurring(false);
              }}
              aria-label="Add Income"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-lg leading-none text-white dark:bg-white dark:text-black"
            >
              {addingKind === "income" ? "×" : "+"}
            </button>
          }
        >
          <ul className="flex flex-col gap-2 py-1">
            {visibleIncome.map((item) => (
              <SandboxMonthlyItemRow
                key={item.id}
                kind="income"
                item={item}
                history={data.incomeHistory
                  .filter((h) => h.income_id === item.id)
                  .map((h) => ({ month: h.month, amount: Number(h.amount) }))}
                setData={setData}
              />
            ))}
          </ul>
        </SectionBox>

        <SectionBox
          title="Payments"
          total={paymentTotal}
          headerActions={
            <button
              type="button"
              onClick={() => {
                setAddingKind(addingKind === "subscription" ? null : "subscription");
                setNewRecurring(true);
              }}
              aria-label="Add Payment"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-lg leading-none text-white dark:bg-white dark:text-black"
            >
              {addingKind === "subscription" ? "×" : "+"}
            </button>
          }
        >
          <ul className="flex flex-col gap-2 py-1">
            {visibleSubs.map((sub) => (
              <SandboxMonthlyItemRow
                key={sub.id}
                kind="subscription"
                item={sub}
                negative
                history={data.subscriptionHistory
                  .filter((h) => h.subscription_id === sub.id)
                  .map((h) => ({ month: h.month, amount: Number(h.amount) }))}
                setData={setData}
              />
            ))}
          </ul>
        </SectionBox>
      </div>

      <MonthlyItemsTable
        incomeItems={visibleIncome}
        incomeHistory={data.incomeHistory}
        subscriptions={visibleSubs}
        subscriptionHistory={data.subscriptionHistory}
        now={simMonth}
        onUpdateCell={handleUpdateCell}
      />
    </div>
  );
}

function SandboxMonthlyItemRow({
  kind,
  item,
  history,
  negative,
  setData,
}: {
  kind: "income" | "subscription";
  item: IncomeItem | Subscription;
  history: { month: string; amount: number }[];
  negative?: boolean;
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
}) {
  const [editing, setEditing] = useState(false);
  const sorted = [...history].sort((a, b) => b.month.localeCompare(a.month));
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [recurring, setRecurring] = useState(item.is_recurring);
  const [rows, setRows] = useState<{ month: string; amount: string }[]>(
    sorted.map((h) => ({ month: h.month.slice(0, 7), amount: String(h.amount) }))
  );

  // Sync local form state when rollover changes item.amount or history.
  useEffect(() => {
    setName(item.name);
    setAmount(String(item.amount));
    setRecurring(item.is_recurring);
    const s = [...history].sort((a, b) => b.month.localeCompare(a.month));
    setRows(s.map((h) => ({ month: h.month.slice(0, 7), amount: String(h.amount) })));
  }, [item, history]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const valid = rows.filter((r) => r.month && r.amount !== "");
    if (kind === "income") {
      setData((prev) => ({
        ...prev,
        incomeItems: prev.incomeItems.map((i) =>
          i.id === item.id
            ? { ...i, name, amount: Number(amount) || 0, is_recurring: recurring }
            : i
        ),
        incomeHistory: [
          ...valid.map((r) => ({
            id: `sb-ih-${item.id}-${r.month}`,
            user_id: "sandbox-user",
            income_id: item.id,
            month: `${r.month}-01`,
            amount: Number(r.amount) || 0,
            created_at: new Date().toISOString(),
          })),
          ...prev.incomeHistory.filter((h) => h.income_id !== item.id),
        ],
      }));
    } else {
      setData((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.map((s) =>
          s.id === item.id
            ? { ...s, name, amount: Number(amount) || 0, is_recurring: recurring }
            : s
        ),
        subscriptionHistory: [
          ...valid.map((r) => ({
            id: `sb-sh-${item.id}-${r.month}`,
            user_id: "sandbox-user",
            subscription_id: item.id,
            month: `${r.month}-01`,
            amount: Number(r.amount) || 0,
            created_at: new Date().toISOString(),
          })),
          ...prev.subscriptionHistory.filter((h) => h.subscription_id !== item.id),
        ],
      }));
    }
    setEditing(false);
  }

  return (
    <li className="rounded border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {item.name}
          <span className="ml-1 text-xs text-gray-500">
            ({item.is_recurring ? "recurring" : "one-off"})
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={negative ? "text-red-600" : ""}>
            {formatCurrency(Number(item.amount))}
          </span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border px-2 py-0.5 text-xs"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </span>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="mt-2 flex flex-col gap-2 border-t pt-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 text-gray-600">Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded border px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 text-gray-600">Amount</span>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32 rounded border px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Recur every month
          </label>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                History (auto-rolled over &amp; editable)
              </span>
              <button
                type="button"
                onClick={() => setRows([...rows, { month: "", amount: "" }])}
                className="rounded border px-2 py-0.5 text-xs"
              >
                + Add month
              </button>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex min-w-0 flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={row.month}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...next[i], month: e.target.value };
                    setRows(next);
                  }}
                  className="min-w-0 flex-1 rounded border px-2 py-0.5 text-xs dark:[color-scheme:dark]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...next[i], amount: e.target.value };
                    setRows(next);
                  }}
                  className="w-24 min-w-0 rounded border px-2 py-0.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-600 text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary px-3 py-1 text-xs">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border px-3 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

// ============================================================================
// TAB 3: BUDGETING & PURCHASES (SANDBOX)
// ============================================================================
function SandboxBudgetingTab({
  data,
  setData,
  simMonth,
}: {
  data: SandboxData;
  setData: React.Dispatch<React.SetStateAction<SandboxData>>;
  simMonth: string;
}) {
  const [expCost, setExpCost] = useState("");
  const [expName, setExpName] = useState("");
  const [expBudgetId, setExpBudgetId] = useState(data.budgets[0]?.id ?? "");
  const [expType, setExpType] = useState("General");

  const incomeTotal = data.incomeItems
    .filter((i) => !i.hidden)
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const paymentTotal = data.subscriptions
    .filter((s) => !s.hidden)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const availableCashFlow = incomeTotal - paymentTotal;

  const rows = budgetSpend(simMonth, data.budgets, data.expenses);
  const totalLimit = data.budgets.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const monthExpenses = data.expenses.filter((e) => e.occurred_on.slice(0, 7) === simMonth);

  function handleLogPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!expBudgetId || !expCost) return;
    const created: Expense = {
      id: `sb-exp-${Date.now()}`,
      user_id: "sandbox-user",
      budget_id: expBudgetId,
      amount: Number(expCost) || 0,
      name: expName.trim() || null,
      purchase_type: expType || "General",
      occurred_on: `${simMonth}-15`,
      occurred_time: "12:00:00",
      created_at: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, expenses: [created, ...prev.expenses] }));
    setExpCost("");
    setExpName("");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Budgeting — {monthLabel(simMonth)}</h2>

      <div className="rounded border border-black p-3 text-center dark:border-white">
        <p className="text-xs uppercase text-gray-500">Available Monthly Cash Flow</p>
        <p className="text-xs text-gray-500">(Income − Payments)</p>
        <p className={`text-2xl font-bold ${availableCashFlow < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(availableCashFlow)}
        </p>
      </div>

      <section className="rounded border">
        <h3 className="border-b px-4 py-2 text-lg font-medium">
          Budgets for {monthLabel(simMonth)}
        </h3>
        <div className="px-4 py-2">
          {rows.length === 0 ? (
            <p className="py-1 text-sm text-gray-500">No budgets in sandbox.</p>
          ) : (
            <ul className="flex flex-col gap-2 py-1">
              {rows.map(({ budget, spent }) => {
                const limit = Number(budget.monthly_limit);
                const over = spent > limit;
                const typeSpends = budgetSpendByType(
                  simMonth,
                  budget,
                  data.expenses,
                  data.purchaseTypes
                );
                return (
                  <li key={budget.id} className="rounded border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">
                        {budget.emoji ? `${budget.emoji} ` : ""}
                        {budget.name}
                      </span>
                      <span className={over ? "font-semibold text-red-600" : ""}>
                        {formatCurrency(spent)} / {formatCurrency(limit)}
                        {budget.limit_percent != null && (
                          <span className="text-gray-500"> ({budget.limit_percent}%)</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex h-3 overflow-hidden rounded bg-gray-100 dark:bg-neutral-800">
                      {typeSpends.map((t) => (
                        <div
                          key={t.name}
                          className="h-3"
                          style={{
                            width: `${Math.min(100, (t.spent / Math.max(limit, 1)) * 100)}%`,
                            backgroundColor: t.color || colorForName(t.name),
                          }}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex justify-between border-t px-4 py-2 font-bold">
          <span>Total</span>
          <span>{formatCurrency(totalLimit)}</span>
        </div>
      </section>

      <section className="rounded border">
        <h3 className="border-b px-4 py-2 text-lg font-medium">
          Purchases in {monthLabel(simMonth)}
        </h3>
        <form onSubmit={handleLogPurchase} className="flex flex-wrap gap-2 border-b p-3 text-sm">
          <input
            type="number"
            step="0.01"
            placeholder="Cost"
            required
            value={expCost}
            onChange={(e) => setExpCost(e.target.value)}
            className="w-28 rounded border px-2 py-1"
          />
          <select
            value={expBudgetId}
            onChange={(e) => setExpBudgetId(e.target.value)}
            className="rounded border bg-white px-2 py-1 text-black"
          >
            {data.budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.emoji ? `${b.emoji} ` : ""}
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Purchase name"
            value={expName}
            onChange={(e) => setExpName(e.target.value)}
            className="min-w-0 flex-1 rounded border px-2 py-1"
          />
          <input
            type="text"
            placeholder="Type (e.g. Groceries)"
            value={expType}
            onChange={(e) => setExpType(e.target.value)}
            className="w-32 rounded border px-2 py-1"
          />
          <button type="submit" className="btn-primary px-3 py-1 text-xs">
            + Log Purchase
          </button>
        </form>
        {monthExpenses.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">
            No purchases logged for {monthLabel(simMonth)} yet. (Prior months&apos; purchases stay archived in their own months!)
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {monthExpenses.map((e) => {
              const b = data.budgets.find((x) => x.id === e.budget_id);
              return (
                <li key={e.id} className="flex items-center justify-between px-4 py-2">
                  <span>
                    <strong>{e.name || "(unnamed)"}</strong> — {b?.name ?? "Undefined"} (
                    {e.occurred_on})
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-red-600">{formatCurrency(Number(e.amount))}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          expenses: prev.expenses.filter((x) => x.id !== e.id),
                        }))
                      }
                      className="rounded border border-red-600 px-2 py-0.5 text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// TAB 4: HOME OVERVIEW (SANDBOX)
// ============================================================================
function SandboxHomeTab({ data, simMonth }: { data: SandboxData; simMonth: string }) {
  const worth = netWorth(data.accounts);
  const revenue = monthlyRevenue(simMonth, data.incomeItems, data.incomeHistory, simMonth);
  const spend = monthlySpend(
    simMonth,
    data.expenses,
    data.subscriptions,
    data.subscriptionHistory,
    simMonth
  );
  const difference = monthlyNetWorthDifference(
    simMonth,
    data.expenses,
    data.subscriptions,
    data.subscriptionHistory,
    data.incomeItems,
    data.incomeHistory,
    simMonth
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Home Overview — {monthLabel(simMonth)}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 ring-1 ring-foreground/20">
          <p className="text-xs uppercase tracking-wide text-muted">Net Worth</p>
          <p className="ledger text-2xl font-semibold">{formatCurrency(worth)}</p>
        </div>
        <div className="card p-4 text-green-600">
          <p className="text-xs uppercase tracking-wide text-muted">Monthly Revenue</p>
          <p className="ledger text-2xl font-semibold">{formatCurrency(revenue)}</p>
        </div>
        <div className={`card p-4 ${difference < 0 ? "text-red-600" : "text-green-600"}`}>
          <p className="text-xs uppercase tracking-wide text-muted">
            Net Worth Change ({monthLabel(simMonth)})
          </p>
          <p className="ledger text-2xl font-semibold">{formatCurrency(difference)}</p>
        </div>
        <div className="card p-4 text-red-600">
          <p className="text-xs uppercase tracking-wide text-muted">Monthly Spend</p>
          <p className="ledger text-2xl font-semibold">{formatCurrency(-spend)}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 5: FORECAST (SANDBOX)
// ============================================================================
function SandboxForecastTab({ data, simMonth }: { data: SandboxData; simMonth: string }) {
  const forecast = forecastNextMonth(
    data.expenses,
    data.subscriptions,
    data.subscriptionHistory,
    simMonth
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Forecast (as of {monthLabel(simMonth)})</h2>
      <div className="rounded border border-black p-4 text-center dark:border-white">
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
        <h3 className="border-b px-4 py-2 text-lg font-medium">Months used</h3>
        <ul className="divide-y text-sm">
          {forecast.monthsUsed.map((m) => (
            <li key={m} className="flex justify-between px-4 py-2">
              <span>{monthLabel(m)}</span>
              <span>
                {formatCurrency(
                  monthlySpend(
                    m,
                    data.expenses,
                    data.subscriptions,
                    data.subscriptionHistory,
                    simMonth
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ============================================================================
// TAB 6: ROLLOVER LOG (SANDBOX)
// ============================================================================
function SandboxLogTab({ logs }: { logs: RolloverSummary[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded border p-4 text-sm text-gray-500">
        No monthly rollovers simulated yet. Click <strong>Simulate Next Month Rollover →</strong> above to advance the month and inspect every rollover action here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log, i) => (
        <section key={`${log.completedMonth}-${i}`} className="rounded border p-4 text-sm">
          <h3 className="font-semibold text-base">
            {monthLabel(log.completedMonth)} → {monthLabel(log.nextMonth)}
          </h3>
          <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong>Accounts archived to history ({log.accountsArchived.length}):</strong>{" "}
              {log.accountsArchived.length === 0
                ? "None (already archived)"
                : log.accountsArchived
                    .map((a) => `${a.name} (${formatCurrency(a.amount)})`)
                    .join(", ")}
            </li>
            {log.annualPayablesAccrued.length > 0 && (
              <li>
                <strong>Annual subscription payables accrued:</strong>{" "}
                {log.annualPayablesAccrued
                  .map(
                    (a) =>
                      `${a.name}: ${formatCurrency(a.previousAmount)} + ${formatCurrency(
                        a.accrued
                      )}/mo → ${formatCurrency(a.newAmount)}`
                  )
                  .join("; ")}
              </li>
            )}
            <li>
              <strong>Income items archived ({log.incomeArchived.length}):</strong>{" "}
              {log.incomeArchived.length === 0
                ? "None"
                : log.incomeArchived
                    .map((x) => `${x.name} (${formatCurrency(x.amount)})`)
                    .join(", ")}
            </li>
            {log.nonRecurringIncomeReset.length > 0 && (
              <li>
                <strong>Non-recurring income reset to $0.00 for {monthLabel(log.nextMonth)}:</strong>{" "}
                {log.nonRecurringIncomeReset
                  .map((x) => `${x.name} (was ${formatCurrency(x.previousAmount)})`)
                  .join(", ")}
              </li>
            )}
            <li>
              <strong>Payments archived ({log.paymentsArchived.length}):</strong>{" "}
              {log.paymentsArchived.length === 0
                ? "None"
                : log.paymentsArchived
                    .map((x) => `${x.name} (${formatCurrency(x.amount)})`)
                    .join(", ")}
            </li>
            {log.nonRecurringPaymentsReset.length > 0 && (
              <li>
                <strong>Non-recurring payments reset to $0.00 for {monthLabel(log.nextMonth)}:</strong>{" "}
                {log.nonRecurringPaymentsReset
                  .map((x) => `${x.name} (was ${formatCurrency(x.previousAmount)})`)
                  .join(", ")}
              </li>
            )}
            {log.budgetsRecalculated.length > 0 && (
              <li>
                <strong>Percentage budgets recalculated for new cash flow:</strong>{" "}
                {log.budgetsRecalculated
                  .map(
                    (b) =>
                      `${b.name} (${b.limitPercent}%): ${formatCurrency(
                        b.previousLimit
                      )} → ${formatCurrency(b.newLimit)}`
                  )
                  .join("; ")}
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

