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

  const generateReport = useCallback((): DailyReport => {
    const today = getTodayKey();
    const allTxns = getItem<Transaction[]>(KEYS.TRANSACTIONS) ?? [];
    const todayTxns = allTxns.filter((t) => t.date === today && !t.deleted);
    const allExpenses = getItem<Expense[]>(KEYS.EXPENSES) ?? [];
    const todayExpenses = allExpenses.filter((e) => e.date === today && !e.deleted);
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
      syncStatus: "pending",
    };
  }, [getOpeningCash]);

  const closeDay = useCallback((): DailyReport => {
    const report = generateReport();
    // Archive the report
    const existing = getItem<DailyReport[]>(KEYS.ARCHIVED_REPORTS) ?? [];
    setItem(KEYS.ARCHIVED_REPORTS, [...existing, report]);

    // We no longer remove today's transactions from live store
    // This allows the History page to view transactions from any day
    
    // Clear opening cash
    removeItem(KEYS.OPENING_CASH);
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("syncRequested"));
    }
    
    return report;
  }, [generateReport]);

  const getArchivedReports = useCallback((): DailyReport[] => {
    return getItem<DailyReport[]>(KEYS.ARCHIVED_REPORTS) ?? [];
  }, []);

  return {
    getOpeningCash,
    setOpeningCash,
    generateReport,
    closeDay,
    getArchivedReports,
  };
}
