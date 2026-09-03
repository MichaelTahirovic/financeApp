"use client";

import * as XLSX from "xlsx";
import {
  currentMonth,
  effectiveMonthlyAmount,
  formatCurrency,
  monthLabel,
  monthlyRevenue,
  monthlySpend,
  netWorth,
  budgetSpend,
} from "@/lib/finance/calculations";
import type { ExportData } from "./page";

/**
 * Export page: download as Excel, or open the print/PDF report.
 * The report uses only black/grey/white/green/red on a white background and
 * contains no edit or select controls.
 */
export default function ExportClient({ data }: { data: ExportData }) {
  const now = currentMonth();

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Accounts sheet
    const accountsRows = data.accounts.map((a) => ({
      Name: a.name,
      Kind: a.kind,
      Amount: Number(a.amount),
      "Monthly Amount": effectiveMonthlyAmount(a),
      "Annual Payment": a.is_annual_subscription ? "Yes" : "No",
      "Annual Amount": a.annual_amount ?? "",
      Hidden: a.hidden ? "Yes" : "No",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accountsRows), "Accounts");

    // Account history sheet
    const accHistRows = data.accountHistory.map((h) => ({
      Account: data.accounts.find((a) => a.id === h.account_id)?.name ?? "",
      Month: h.month.slice(0, 7),
      Amount: Number(h.amount),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accHistRows), "Account History");

    // Monthly Items sheet (income + payments)
    const incomeRows = data.incomeItems.map((i) => ({
      Type: "Income",
      Name: i.name,
      Amount: Number(i.amount),
      Recurring: i.is_recurring ? "Yes" : "No",
      Hidden: i.hidden ? "Yes" : "No",
    }));
    const paymentRows = data.subscriptions.map((s) => ({
      Type: "Payment",
      Name: s.name,
      Amount: Number(s.amount),
      Recurring: s.is_recurring ? "Yes" : "No",
      Hidden: s.hidden ? "Yes" : "No",
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([...incomeRows, ...paymentRows]),
      "Monthly Items"
    );

    // Recent purchases (budgeting)
    const purchaseRows = data.expenses.map((e) => ({
      Name: e.name ?? "",
      Budget: data.budgets.find((b) => b.id === e.budget_id)?.name ?? "",
      "Purchase Type": e.purchase_type ?? "General",
      Amount: Number(e.amount),
      Date: e.occurred_on,
      Time: e.occurred_time ? e.occurred_time.slice(0, 5) : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseRows), "Purchases");

    XLSX.writeFile(wb, `finance-export-${now}.xlsx`);
  }

  function openReport() {
    window.print();
  }

  // --- Report figures (current month) ---
  const spend = monthlySpend(now, data.expenses, data.subscriptions, data.subscriptionHistory);
  const revenue = monthlyRevenue(now, data.incomeItems, data.incomeHistory);
  const worth = netWorth(data.accounts);
  const difference = revenue - spend;
  const budgetRows = budgetSpend(now, data.budgets, data.expenses);

  const receivables = data.accounts.filter((a) => a.kind === "receivable");
  const payables = data.accounts.filter((a) => a.kind === "payable");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="no-print flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="text-sm text-gray-500">
          Download your data as an Excel sheet, or open the print view to save as PDF / print.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} className="btn-primary px-4 py-2">
            Download Excel (.xlsx)
          </button>
          <button onClick={openReport} className="rounded border px-4 py-2 text-sm">
            Print / Save as PDF
          </button>
        </div>
        <p className="text-xs text-gray-500">
          The printed/PDF report uses only black, grey, white, green, and red on a white
          background, and excludes all edit/select controls.
        </p>
      </div>

      {/* Print / PDF report */}
      <div className="report print:block">
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
          <ReportTable
            head={["Account", "Kind", "Amount"]}
            rows={data.accounts.map((a) => [
              a.name,
              a.kind === "payable" ? "Payable" : "Receivable",
              formatCurrency(Number(a.amount)),
            ])}
          />
        </ReportSection>

        <ReportSection title="Monthly Items">
          <h3 className="report-sub">
            Available Monthly Cash Flow: {formatCurrency(revenue - spend)}
          </h3>
          <h4 className="report-h4">Income</h4>
          <ReportTable
            head={["Name", "Amount", "Recurring"]}
            rows={data.incomeItems.map((i) => [
              i.name,
              formatCurrency(Number(i.amount)),
              i.is_recurring ? "Yes" : "No",
            ])}
          />
          <h4 className="report-h4">Payments</h4>
          <ReportTable
            head={["Name", "Amount", "Recurring"]}
            rows={data.subscriptions.map((s) => [
              s.name,
              formatCurrency(Number(s.amount)),
              s.is_recurring ? "Yes" : "No",
            ])}
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

function ReportTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="report-empty">None.</p>;
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
