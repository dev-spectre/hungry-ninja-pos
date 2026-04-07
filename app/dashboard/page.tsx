"use client";

import { useEffect, useState, useMemo } from "react";
import {
  IndianRupee,
  Banknote,
  Smartphone,
  CreditCard,
  ShoppingBag,
  CalendarDays,
  Receipt,
  TrendingDown,
  FileBarChart,
} from "lucide-react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import TopProducts from "@/components/dashboard/TopProducts";
import SlowMovingAlert from "@/components/dashboard/SlowMovingAlert";
import { useTransactions } from "@/hooks/useTransactions";
import { useExpenses } from "@/hooks/useExpenses";
import { useProducts } from "@/hooks/useProducts";
import { DailySummary } from "@/types";
import { formatCurrency, formatDate, getTodayKey } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { getDailySummary, transactions } = useTransactions();
  const { getTotalToday } = useExpenses();
  const { products } = useProducts();

  const [summary, setSummary] = useState<DailySummary>({
    totalSales: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
    totalItems: 0,
  });
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    setSummary(getDailySummary());
    setTotalExpenses(getTotalToday());
  }, [transactions, getDailySummary, getTotalToday]);

  const netProfit = summary.totalSales - totalExpenses;
  const todayLabel = formatDate(getTodayKey());
  const txnCount = transactions.length;

  const cards = [
    {
      label: "Total Sales Today",
      value: formatCurrency(summary.totalSales),
      icon: <IndianRupee size={20} />,
      color: "var(--accent)",
      bgColor: "var(--accent-soft)",
      subtitle: `${txnCount} bills`,
    },
    {
      label: "Cash Sales",
      value: formatCurrency(summary.cashSales),
      icon: <Banknote size={20} />,
      color: "var(--green)",
      bgColor: "var(--green-soft)",
    },
    {
      label: "UPI Sales",
      value: formatCurrency(summary.upiSales),
      icon: <Smartphone size={20} />,
      color: "var(--yellow)",
      bgColor: "var(--yellow-soft)",
    },
    {
      label: "Card Sales",
      value: formatCurrency(summary.cardSales),
      icon: <CreditCard size={20} />,
      color: "var(--blue)",
      bgColor: "var(--blue-soft)",
    },
    {
      label: "Total Items Sold",
      value: summary.totalItems.toString(),
      icon: <ShoppingBag size={20} />,
      color: "var(--purple)",
      bgColor: "var(--purple-soft)",
    },
    {
      label: "Total Expenses",
      value: formatCurrency(totalExpenses),
      icon: <Receipt size={20} />,
      color: "var(--orange)",
      bgColor: "var(--orange-soft)",
    },
    {
      label: "Net Profit",
      value: formatCurrency(netProfit),
      icon: <TrendingDown size={20} />,
      color: netProfit >= 0 ? "var(--green)" : "var(--red)",
      bgColor: netProfit >= 0 ? "var(--green-soft)" : "var(--red-soft)",
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Date Banner */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <CalendarDays size={22} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-base leading-tight">{todayLabel}</p>
          <p className="text-white/70 text-xs">Live Sales Dashboard</p>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Sales — full width */}
        <div className="col-span-2">
          <SummaryCard {...cards[0]} />
        </div>
        {/* Cash, UPI, Card, Items */}
        {cards.slice(1, 5).map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
        {/* Expenses + Net Profit — full width each */}
        <SummaryCard {...cards[5]} />
        <SummaryCard {...cards[6]} />
      </div>

      {/* Top Products */}
      <TopProducts transactions={transactions} />

      {/* Slow Moving Alert */}
      <SlowMovingAlert products={products} transactions={transactions} threshold={2} />

      {/* Quick Actions */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 p-3 rounded-xl font-medium text-sm transition-all active:scale-95"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <ShoppingBag size={16} /> New Bill
          </Link>
          <Link
            href="/expenses"
            className="flex items-center gap-2 p-3 rounded-xl font-medium text-sm transition-all active:scale-95"
            style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
          >
            <Receipt size={16} /> Add Expense
          </Link>
          <Link
            href="/history"
            className="flex items-center gap-2 p-3 rounded-xl font-medium text-sm transition-all active:scale-95"
            style={{ background: "var(--green-soft)", color: "var(--green)" }}
          >
            <CalendarDays size={16} /> View History
          </Link>
          <Link
            href="/closing"
            className="flex items-center gap-2 p-3 rounded-xl font-medium text-sm transition-all active:scale-95"
            style={{ background: "var(--purple-soft)", color: "var(--purple)" }}
          >
            <FileBarChart size={16} /> Close Day
          </Link>
        </div>
      </div>
    </div>
  );
}
