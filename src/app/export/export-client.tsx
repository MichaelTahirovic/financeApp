"use client";

import { Fragment, useState } from "react";
import * as XLSX from "xlsx";
import {
  currentMonth,
  formatCurrency,
  monthLabel,
  monthlyRevenue,
  monthlySpend,
  netWorth,
  budgetSpend,
} from "@/lib/finance/calculations";
import type { ExportData } from "./page";
import {
  accountsHistory,
  budgetsHistory,
  monthlyItemsHistory,
  type HistoryCell,
} from "./history-builders";

const MONTH_OPTIONS = [1, 3, 6, 12];

export default function ExportClient({ data }: { data: ExportData }) {
  const now = currentMonth();
  const [monthCount, setMonthCount] = useState(3);

  // Current-month figures for the overview + single-month tables.
  const spend = monthlySpend(now, data.expenses, data.subscriptions, data.subscriptionHistory);
  const revenue = monthlyRevenue(now, data.incomeItems, data.incomeHistory);
  const worth = netWorth(data.accounts);
  const difference = revenue - spend;
  const budgetRows = budgetSpend(now, data.budgets, data.expenses);

  const receivables = data.accounts.filter((a) => a.kind === "receivable");
  const payables = data.accounts.filter((a) => a.kind === "payable");
  const receivableTotal = receivables.reduce((s, a) => s + Number(a.amount), 0);
  const payableTotal = payables.reduce((s, a) => s + Number(a.amount), 0);
  const incomeTotal = data.incomeItems.reduce((s, i) => s + Number(i.amount), 0);
  const paymentTotal = data.subscriptions.reduce((s, x) => s + Number(x.amount), 0);

  // History tables (months as columns) for the chosen window.
  const accHist = accountsHistory(data, monthCount);
  const itemHist = monthlyItemsHistory(data, monthCount);
  const budHist = budgetsHistory(data, monthCount);

  // ---------- Excel ----------
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const sheetFrom = (rows: (string | number)[][], name: string) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);

    // Accounts Receivable / Payable (split, with totals)
    const accSheet = (list: typeof data.accounts, total: number, title: string) => {
      const rows: (string | number)[][] = [
        [title],
        ["Name", "Amount", "Monthly Amount", "Annual Payment", "Annual Amount", "Hidden"],
        ...list.map((a) => [
          a.name,
          Number(a.amount),
          Number(a.amount),
          a.is_annual_subscription ? "Yes" : "No",
          a.annual_amount ?? "",
          a.hidden ? "Yes" : "No",
        ]),
        ["Total", total, "", "", "", ""],
      ];
      sheetFrom(rows, title);
    };
    accSheet(receivables, receivableTotal, "Accounts Receivable");
    accSheet(payables, payableTotal, "Accounts Payable");

    // Monthly Items: Income / Payments with totals
    const incomeRows: (string | number)[][] = [
      ["Income"],
      ["Name", "Amount", "Recurring", "Hidden"],
      ...data.incomeItems.map((i) => [i.name, Number(i.amount), i.is_recurring ? "Yes" : "No", i.hidden ? "Yes" : "No"]),
      ["Total", incomeTotal, "", ""],
    ];
    sheetFrom(incomeRows, "Income");
    const paymentRows: (string | number)[][] = [
      ["Payments"],
      ["Name", "Amount", "Recurring", "Hidden"],
      ...data.subscriptions.map((s) => [s.name, Number(s.amount), s.is_recurring ? "Yes" : "No", s.hidden ? "Yes" : "No"]),
      ["Total", paymentTotal, "", ""],
    ];
    sheetFrom(paymentRows, "Payments");

    // History sheets (months as columns)
    sheetFrom(historyToAoa(accHist.months, accHist.receivableRows, accHist.totalReceivable, "Total Receivable"), "Accounts Receivable Hist");
    sheetFrom(historyToAoa(accHist.months, accHist.payableRows, accHist.totalPayable, "Total Payable"), "Accounts Payable Hist");
    sheetFrom(historyToAoa(itemHist.months, itemHist.incomeRows, itemHist.totalIncome, "Total Income"), "Income History");
    sheetFrom(historyToAoa(itemHist.months, itemHist.paymentRows, itemHist.totalPayments, "Total Payments"), "Payments History");

    const budRows: (string | number)[][] = [
      ["Budget", "Limit", ...budHist.months],
      ...budHist.rows.map((r) => [r.label, r.limit, ...r.spent.map((v) => (v === null ? "" : v))]),
    ];
    sheetFrom(budRows, "Budgets History");

    // Recent purchases (all)
    const purchaseRows: (string | number)[][] = [
      ["Name", "Budget", "Purchase Type", "Amount", "Date", "Time"],
      ...data.expenses.map((e) => [
        e.name ?? "",
        data.budgets.find((b) => b.id === e.budget_id)?.name ?? "",
        e.purchase_type ?? "General",
        Number(e.amount),
        e.occurred_on,
        e.occurred_time ? e.occurred_time.slice(0, 5) : "",
      ]),
    ];
    sheetFrom(purchaseRows, "Purchases");

    XLSX.writeFile(wb, `finance-export-${now}.xlsx`);
  }

  function historyToAoa(
    months: string[],
    rows: HistoryCell[],
    totals: number[],
    totalLabel: string
  ): (string | number)[][] {
    return [
      ["Record", ...months],
      ...rows.map((r) => [
        r.label,
        ...r.values.map((v) => (v === null ? "" : v)),
      ]),
      [totalLabel, ...totals],
    ];
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="no-print flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="text-sm text-gray-500">
          Download your data as an Excel sheet, or open the print view to save as PDF / print.
        </p>
        <label className="flex items-center gap-2 text-sm">
          History window:
          <select
            value={monthCount}
            onChange={(e) => setMonthCount(Number(e.target.value))}
            className="rounded border bg-white px-2 py-1 text-black"
          >
            {MONTH_OPTIONS.map((n) => (
              <option key={n} value={n} className="text-black">
                {n} month{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} className="btn-primary px-4 py-2">
            Download Excel (.xlsx)
          </button>
          <button onClick={() => window.print()} className="rounded border px-4 py-2 text-sm">
            Print / Save as PDF
          </button>
        </div>
        <p className="text-xs text-gray-500">
          The report uses only black, grey, white, green, and red on white, with no edit/select
          controls.
        </p>
      </div>

      <div className="report">
        <ReportSection title={`Overview — ${monthLabel(now)}`}>
          <table className="report-table">
            <tbody>
              <ReportRow label="Net Worth" value={worth} />
              <ReportRow label="Monthly Revenue" value={revenue} tone="green" />
              <ReportRow label="Net Worth Change" value={difference} tone={difference < 0 ? "red" : "green"} />
              <ReportRow label="Monthly Spend" value={-spend} tone="red" />
            </tbody>
          </table>
        </ReportSection>

        <ReportSection title="Accounts">
          <h3 className="report-sub">Net Worth (Receivable − Payable): {formatCurrency(worth)}</h3>
          <h4 className="report-h4">Accounts Receivable</h4>
          <ReportTable
            head={["Account", "Amount"]}
            rows={receivables.map((a) => [a.name, formatCurrency(Number(a.amount))])}
            total={["Total", formatCurrency(receivableTotal)]}
          />
          <h4 className="report-h4">Accounts Payable</h4>
          <ReportTable
            head={["Account", "Amount"]}
            rows={payables.map((a) => [a.name, formatCurrency(Number(a.amount))])}
            total={["Total", formatCurrency(payableTotal)]}
          />
        </ReportSection>

        <ReportSection title="Monthly Items">
          <h3 className="report-sub">
            Available Monthly Cash Flow: {formatCurrency(incomeTotal - paymentTotal)}
          </h3>
          <h4 className="report-h4">Income</h4>
          <ReportTable
            head={["Name", "Amount", "Recurring"]}
            rows={data.incomeItems.map((i) => [i.name, formatCurrency(Number(i.amount)), i.is_recurring ? "Yes" : "No"])}
            total={["Total", formatCurrency(incomeTotal), ""]}
          />
          <h4 className="report-h4">Payments</h4>
          <ReportTable
            head={["Name", "Amount", "Recurring"]}
            rows={data.subscriptions.map((s) => [s.name, formatCurrency(Number(s.amount)), s.is_recurring ? "Yes" : "No"])}
            total={["Total", formatCurrency(paymentTotal), ""]}
          />
        </ReportSection>

        <ReportSection title="Budgets">
          <ReportTable
            head={["Budget", "Spent", "Limit"]}
            rows={budgetRows.map(({ budget, spent }) => [
              `${budget.emoji ? budget.emoji + " " : ""}${budget.name}`,
              formatCurrency(spent),
              formatCurrency(Number(budget.monthly_limit)),
            ])}
            total={["Total", formatCurrency(budgetRows.reduce((s, r) => s + r.spent, 0)), formatCurrency(budgetRows.reduce((s, r) => s + Number(r.budget.monthly_limit), 0))]}
          />
        </ReportSection>

        <ReportSection title={`Purchases — ${monthLabel(now)}`}>
          <ReportTable
            head={["Name", "Budget", "Type", "Amount", "Date"]}
            rows={data.currentMonthExpenses.map((e) => [
              e.name ?? "(unnamed)",
              data.budgets.find((b) => b.id === e.budget_id)?.name ?? "",
              e.purchase_type ?? "General",
              formatCurrency(Number(e.amount)),
              e.occurred_on + (e.occurred_time ? ` ${e.occurred_time.slice(0, 5)}` : ""),
            ])}
          />
        </ReportSection>

        <ReportSection title={`Accounts History — last ${monthCount} month${monthCount > 1 ? "s" : ""}`}>
          <HistoryReportTable
            months={accHist.months}
            sections={[
              { label: "Receivable", rows: accHist.receivableRows, total: accHist.totalReceivable, totalLabel: "Total Receivable" },
              { label: "Payable", rows: accHist.payableRows, total: accHist.totalPayable, totalLabel: "Total Payable" },
            ]}
            finalRow={{ label: "Net Worth", values: accHist.netWorth }}
          />
        </ReportSection>

        <ReportSection title={`Monthly Items History — last ${monthCount} month${monthCount > 1 ? "s" : ""}`}>
          <HistoryReportTable
            months={itemHist.months}
            sections={[
              { label: "Income", rows: itemHist.incomeRows, total: itemHist.totalIncome, totalLabel: "Total Income" },
              { label: "Payments", rows: itemHist.paymentRows, total: itemHist.totalPayments, totalLabel: "Total Payments" },
            ]}
            finalRow={{ label: "Available Cash Flow", values: itemHist.cashFlow }}
          />
        </ReportSection>

        <ReportSection title={`Budgets History — last ${monthCount} month${monthCount > 1 ? "s" : ""}`}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Budget</th>
                <th>Limit</th>
                {budHist.months.map((m) => (
                  <th key={m}>{monthLabel(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budHist.rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{formatCurrency(r.limit)}</td>
                  {r.spent.map((v, i) => (
                    <td key={i}>{v === null ? "—" : formatCurrency(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      </div>
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section">
      <h2 className="report-h2">{title}</h2>
      {children}
    </section>
  );
}

function ReportTable({
  head,
  rows,
  total,
}: {
  head: string[];
  rows: (string | number)[][];
  total?: (string | number)[];
}) {
  if (rows.length === 0 && !total) return <p className="report-empty">None.</p>;
  return (
    <table className="report-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
        {total && (
          <tr className="report-total">
            {total.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

function HistoryReportTable({
  months,
  sections,
  finalRow,
}: {
  months: string[];
  sections: { label: string; rows: HistoryCell[]; total: number[]; totalLabel: string }[];
  finalRow: { label: string; values: number[] };
}) {
  return (
    <table className="report-table">
      <thead>
        <tr>
          <th>Record</th>
          {months.map((m) => (
            <th key={m}>{monthLabel(m)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sections.map((section) => (
          <Fragment key={section.label}>
            <tr className="report-group">
              <td colSpan={months.length + 1}>{section.label}</td>
            </tr>
            {section.rows.map((r) => (
              <tr key={section.label + r.label}>
                <td>{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={r.negative || (v !== null && v < 0) ? "text-red-700" : ""}>
                    {v === null ? "—" : formatCurrency(v)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="report-total">
              <td>{section.totalLabel}</td>
              {section.total.map((v, i) => (
                <td key={i}>{formatCurrency(v)}</td>
              ))}
            </tr>
          </Fragment>
        ))}
        <tr className="report-grand-total">
          <td>{finalRow.label}</td>
          {finalRow.values.map((v, i) => (
            <td key={i} className={v < 0 ? "text-red-700" : ""}>
              {formatCurrency(v)}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function ReportRow({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : "";
  return (
    <tr>
      <td>{label}</td>
      <td className={color}>{formatCurrency(value)}</td>
    </tr>
  );
}
