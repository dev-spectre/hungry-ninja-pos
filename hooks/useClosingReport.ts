"use client";

import { useCallback } from "react";
import { DailyReport, Transaction, Expense } from "@/types";
import { getItem, setItem, removeItem, KEYS } from "@/lib/storage";
import { getTodayKey, generateId } from "@/lib/utils";

interface OpeningCashRecord {
  date: string;
  amount: number;
}

export function useClosingReport() {
  const getOpeningCash = useCallback((): number => {
    const record = getItem<OpeningCashRecord>(KEYS.OPENING_CASH);
    if (!record || record.date !== getTodayKey()) return 0;
    return record.amount;
  }, []);

  const setOpeningCash = useCallback((amount: number) => {
    setItem<OpeningCashRecord>(KEYS.OPENING_CASH, {
      date: getTodayKey(),
      amount,
    });
  }, []);

  const generateReport = useCallback(
    async (todayTxns: Transaction[], todayExpenses: Expense[]): Promise<DailyReport> => {
      const today = getTodayKey();
      const openingCash = getOpeningCash();

      const totalSales = todayTxns.reduce((s, t) => s + t.total, 0);
      const cashSales = todayTxns
        .filter((t) => t.paymentMode === "cash")
        .reduce((s, t) => s + t.total, 0);
      const upiSales = todayTxns
        .filter((t) => t.paymentMode === "upi")
        .reduce((s, t) => s + t.total, 0);
      const cardSales = todayTxns
        .filter((t) => t.paymentMode === "card")
        .reduce((s, t) => s + t.total, 0);
      const totalItems = todayTxns.reduce(
        (s, t) => s + t.items.reduce((is, i) => is + i.quantity, 0),
        0
      );
      const totalExpenses = todayExpenses.reduce((s, e) => s + e.amount, 0);
      const netProfit = totalSales - totalExpenses;

      return {
        id: generateId(),
        date: today,
        archivedAt: Date.now(),
        openingCash,
        summary: {
          totalSales,
          cashSales,
          upiSales,
          cardSales,
          totalItems,
        },
        totalExpenses,
        netProfit,
        transactionCount: todayTxns.length,
        transactions: todayTxns,
        expenses: todayExpenses,
      };
    },
    [getOpeningCash]
  );

  const closeDay = useCallback(
    async (todayTxns: Transaction[], todayExpenses: Expense[]): Promise<DailyReport> => {
      const report = await generateReport(todayTxns, todayExpenses);

      // Save report to DB
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const msg = j?.error || `Failed to close day (HTTP ${res.status})`;
        throw new Error(msg);
      }

      // Clear opening cash
      removeItem(KEYS.OPENING_CASH);

      return report;
    },
    [generateReport]
  );

  const getArchivedReports = useCallback(async (): Promise<DailyReport[]> => {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
    return [];
  }, []);

  return {
    getOpeningCash,
    setOpeningCash,
    generateReport,
    closeDay,
    getArchivedReports,
  };
}
