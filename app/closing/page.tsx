"use client";

import { useState, useEffect, useCallback } from "react";
import { useClosingReport } from "@/hooks/useClosingReport";
import { useTransactions } from "@/hooks/useTransactions";
import { useExpenses } from "@/hooks/useExpenses";
import { DailyReport } from "@/types";
import { formatCurrency, formatDate, formatTime, getTodayKey } from "@/lib/utils";
import {
  FileBarChart,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  IndianRupee,
  Banknote,
  Smartphone,
  CreditCard,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Lock,
} from "lucide-react";
import { getItem } from "@/lib/storage";
import { KEYS } from "@/lib/storage";
import { usePermissions } from "@/hooks/usePermissions";

function PinModal({
  onConfirm,
  onCancel,
  title,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function check() {
    const savedPin = getItem<string>(KEYS.ADMIN_PIN) ?? "1234";
    if (pin === savedPin) {
      onConfirm();
    } else {
      setError("Incorrect PIN");
      setPin("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl p-6 w-full max-w-xs space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Lock size={18} style={{ color: "var(--accent)" }} />
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(""); }}
          placeholder="Enter admin PIN"
          autoFocus
          className="w-full px-3 py-3 rounded-xl outline-none text-sm text-center tracking-widest"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
        {error && <p className="text-xs text-center" style={{ color: "var(--red)" }}>{error}</p>}
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>Default PIN: 1234</p>
        <div className="flex gap-2">
          <button onClick={check} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
            Confirm
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportRow({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} style={{ color: color ?? "var(--text-muted)" }} />}
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <span className="text-sm font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function ClosingPage() {
  const { getOpeningCash, setOpeningCash, generateReport, closeDay } = useClosingReport();
  const { transactions } = useTransactions();
  const { getTodayExpenses } = useExpenses();

  const [openingCash, setOpeningCashState] = useState(0);
  const [openingInput, setOpeningInput] = useState("");
  const [openingSet, setOpeningSet] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [showPinForClose, setShowPinForClose] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const histPerms = usePermissions("history");
  const adminPerms = usePermissions("admin");

  const canGenerate = histPerms.read || adminPerms.read;
  const canClose = histPerms.write || adminPerms.write;

  useEffect(() => {
    const saved = getOpeningCash();
    if (saved > 0) {
      setOpeningCash(saved);
      setOpeningCashState(saved);
      setOpeningSet(true);
    }
  }, [getOpeningCash]);

  const handleSetOpeningCash = () => {
    const val = parseFloat(openingInput);
    if (isNaN(val) || val < 0) return;
    setOpeningCash(val);
    setOpeningCashState(val);
    setOpeningSet(true);
  };

  const handleGenerate = useCallback(async () => {
    setActionError(null);
    const todayExpenses = getTodayExpenses();
    const r = await generateReport(transactions, todayExpenses);
    setReport(r);
  }, [generateReport, transactions, getTodayExpenses]);

  const handleCloseDayConfirmed = useCallback(async () => {
    setShowPinForClose(false);
    setActionError(null);
    try {
      const todayExpenses = getTodayExpenses();
      const r = await closeDay(transactions, todayExpenses);
      setReport(r);
      setDayClosed(true);
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to close day");
    }
  }, [closeDay, transactions, getTodayExpenses]);

  // ── Export CSV ──────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!report) return;

    const SEP = ["", "", "", ""];
    const DIVIDER = ["────────────────────", "────────────────", "────────────────", "────────────────"];

    const rows: (string | number)[][] = [
      // Header
      ["DAILY CLOSING REPORT"],
      ["Date:", formatDate(report.date), "", `Generated: ${formatTime(report.archivedAt)}`],
      SEP,

      // Summary Section
      DIVIDER,
      ["SUMMARY", "", "", ""],
      DIVIDER,
      ["", "", "", ""],
      ["Opening Cash", "", "", formatCurrency(report.openingCash)],
      ["", "", "", ""],
      ["Total Sales", "", "", formatCurrency(report.summary.totalSales)],
      ["  Cash Sales", "", "", formatCurrency(report.summary.cashSales)],
      ["  UPI Sales", "", "", formatCurrency(report.summary.upiSales)],
      ["  Card Sales", "", "", formatCurrency(report.summary.cardSales)],
      ["", "", "", ""],
      ["Total Items Sold", "", "", report.summary.totalItems.toString()],
      ["No. of Orders", "", "", report.transactionCount.toString()],
      ["  Cash Orders", "", "", report.transactions.filter(t => t.paymentMode === "cash").length.toString()],
      ["  UPI Orders", "", "", report.transactions.filter(t => t.paymentMode === "upi").length.toString()],
      ["  Card Orders", "", "", report.transactions.filter(t => t.paymentMode === "card").length.toString()],
      ["Total Expenses", "", "", formatCurrency(report.totalExpenses)],
      ["", "", "", ""],
      ["NET PROFIT", "", "", formatCurrency(report.netProfit)],
      SEP,
    ];

    // Transactions Section
    if (report.transactions.length > 0) {
      rows.push(
        DIVIDER,
        [`TRANSACTIONS (${report.transactions.length})`, "", "", ""],
        DIVIDER,
        ["#", "Time", "Items", "Total", "Payment"],
        ...report.transactions.map((t, i) => [
          (i + 1).toString(),
          formatTime(t.timestamp),
          t.items.map((item) => `${item.productName} x${item.quantity}`).join("; "),
          t.total.toFixed(2),
          t.paymentMode.toUpperCase(),
        ]),
        SEP,
      );
    }

    // Expenses Section
    if (report.expenses.length > 0) {
      rows.push(
        DIVIDER,
        [`EXPENSES (${report.expenses.length})`, "", "", ""],
        DIVIDER,
        ["#", "Title", "Category", "Amount", "Notes"],
        ...report.expenses.map((e, i) => [
          (i + 1).toString(),
          e.title,
          e.category,
          e.amount.toFixed(2),
          e.notes ?? "",
        ]),
        SEP,
      );
    }

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closing-report-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  // ── Export PDF via browser print ────────────────────────────────
  const exportPDF = useCallback(() => {
    if (!report) return;
    window.print();
  }, [report]);

  const today = getTodayKey();

  // ── Permission guards (AFTER all hooks) ────────────────────────
  if (histPerms.loading || adminPerms.loading) return null;
  if (!canGenerate) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <Lock size={48} className="text-red-500 opacity-20" />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Access Denied. You do not have permission to view Closing Reports.
        </p>
      </div>
    );
  }

  return (
    <>
      {showPinForClose && (
        <PinModal
          title="Admin PIN — Close Day"
          onConfirm={handleCloseDayConfirmed}
          onCancel={() => setShowPinForClose(false)}
        />
      )}

      <div className="p-4 space-y-4" id="closing-report-root">
        {/* Header */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 no-print"
          style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <FileBarChart size={22} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">Daily Closing Report</p>
            <p className="text-white/70 text-xs">{formatDate(today)}</p>
          </div>
        </div>

        {/* Opening Cash */}
        {!openingSet ? (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Set Opening Cash Balance
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Enter the cash amount available at the start of today.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                placeholder="₹ Opening cash"
                className="flex-1 px-3 py-2.5 rounded-xl outline-none text-sm"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={handleSetOpeningCash}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Set
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-3 p-3 rounded-2xl no-print"
            style={{ background: "var(--green-soft)", border: "1px solid var(--green)" }}
          >
            <CheckCircle size={18} style={{ color: "var(--green)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Opening Cash: {formatCurrency(openingCash)}
              </p>
              <button
                onClick={() => setOpeningSet(false)}
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Generate / Action Buttons */}
        {!dayClosed && (
          <div className="flex gap-2 no-print">
            <button
              onClick={handleGenerate}
              disabled={!openingSet || !canGenerate}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <FileBarChart size={15} /> Generate Report
            </button>
            {report && canClose && (
              <button
                onClick={() => setShowPinForClose(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: "var(--red)", color: "#fff" }}
              >
                <Lock size={15} /> Close Day
              </button>
            )}
          </div>
        )}

        {actionError ? (
          <div className="p-3 rounded-2xl no-print" style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>
              {actionError}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              If this keeps happening, check your session/branch selection and try again.
            </p>
          </div>
        ) : null}

        {dayClosed && (
          <div
            className="flex items-center gap-3 p-3 rounded-2xl no-print"
            style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }}
          >
            <AlertTriangle size={18} style={{ color: "var(--red)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Day closed. Dashboard reset for tomorrow.
            </p>
          </div>
        )}

        {/* Report Summary */}
        {report && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Print Header (visible only on print) */}
            <div className="hidden print-only p-4">
              <h1 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
                Daily Closing Report
              </h1>
              <p style={{ fontSize: "13px", color: "#555" }}>{formatDate(report.date)}</p>
              <p style={{ fontSize: "11px", color: "#888" }}>
                Generated at {formatTime(report.archivedAt)}
              </p>
            </div>

            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Summary
                </p>
                {/* Export buttons */}
                <div className="flex gap-2 no-print">
                  <button
                    onClick={exportPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "var(--blue-soft)", color: "var(--blue)" }}
                  >
                    <Download size={12} /> PDF
                  </button>
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "var(--green-soft)", color: "var(--green)" }}
                  >
                    <FileText size={12} /> CSV
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 pb-2">
              <ReportRow icon={Banknote} label="Opening Cash" value={formatCurrency(report.openingCash)} />
              <ReportRow icon={IndianRupee} label="Total Sales" value={formatCurrency(report.summary.totalSales)} color="var(--accent)" />
              <ReportRow icon={Banknote} label="Cash Collected" value={formatCurrency(report.summary.cashSales)} color="var(--green)" />
              <ReportRow icon={Smartphone} label="UPI Collected" value={formatCurrency(report.summary.upiSales)} color="var(--yellow)" />
              <ReportRow icon={CreditCard} label="Card Collected" value={formatCurrency(report.summary.cardSales)} color="var(--blue)" />
              <ReportRow icon={ShoppingBag} label="Total Items Sold" value={report.summary.totalItems.toString()} color="var(--purple)" />
              <ReportRow icon={FileBarChart} label="No. of Orders" value={report.transactionCount.toString()} />
              <ReportRow icon={Banknote} label="Cash Orders" value={report.transactions.filter(t => t.paymentMode === "cash").length.toString()} color="var(--green)" />
              <ReportRow icon={Smartphone} label="UPI Orders" value={report.transactions.filter(t => t.paymentMode === "upi").length.toString()} color="var(--yellow)" />
              <ReportRow icon={CreditCard} label="Card Orders" value={report.transactions.filter(t => t.paymentMode === "card").length.toString()} color="var(--blue)" />
              <ReportRow icon={Receipt} label="Total Expenses" value={formatCurrency(report.totalExpenses)} color="var(--orange)" />
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} style={{ color: report.netProfit >= 0 ? "var(--green)" : "var(--red)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Net Profit</span>
                </div>
                <span
                  className="text-base font-bold"
                  style={{ color: report.netProfit >= 0 ? "var(--green)" : "var(--red)" }}
                >
                  {formatCurrency(report.netProfit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Transaction breakdown */}
        {report && report.transactions.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Transactions ({report.transactions.length})
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {report.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {t.items.map((i) => `${i.productName}×${i.quantity}`).join(", ")}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatTime(t.timestamp)} · {t.paymentMode.toUpperCase()}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0 ml-2" style={{ color: "var(--accent)" }}>
                    {formatCurrency(t.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense breakdown */}
        {report && report.expenses.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Expenses ({report.expenses.length})
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {report.expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{e.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{e.category}{e.notes ? ` · ${e.notes}` : ""}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0 ml-2" style={{ color: "var(--orange)" }}>
                    {formatCurrency(e.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
