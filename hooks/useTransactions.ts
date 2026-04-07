"use client";

import { useState, useEffect, useCallback } from "react";
import { Transaction, BillItemRecord, PaymentMode, DailySummary } from "@/types";
import { getItem, setItem, KEYS } from "@/lib/storage";
import { getTodayKey, generateId } from "@/lib/utils";

// In-memory flag for dates successfully fetched this session
const sessionFetchedDates = new Set<string>();

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load cached, then refresh from DB
  useEffect(() => {
    let cancelled = false;
    const today = getTodayKey();

    // 1. Instant load from cache (filter to today)
    const cached = getItem<Transaction[]>(KEYS.CACHE_TRANSACTIONS);
    if (cached) {
      setTransactions(cached.filter((t) => t.date === today));
    }

    // 2. Skip DB refresh if we already fetched today's data this session
    if (sessionFetchedDates.has(today)) return;

    // 3. Background refresh from DB
    fetch(`/api/transactions?date=${today}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setTransactions(data);
          setItem(KEYS.CACHE_TRANSACTIONS, data);
          sessionFetchedDates.add(today);
        }
      })
      .catch((err) => console.error("Failed to load transactions:", err));

    return () => { cancelled = true; };
  }, []);

  const saveTransaction = useCallback(
    (items: BillItemRecord[], total: number, paymentMode: PaymentMode): Transaction => {
      const txn: Transaction = {
        id: generateId(),
        date: getTodayKey(),
        timestamp: Date.now(),
        items,
        total,
        paymentMode,
      };

      setTransactions((prev) => {
        const updated = [...prev, txn];
        setItem(KEYS.CACHE_TRANSACTIONS, updated);
        return updated;
      });

      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txn),
      }).catch((err) => console.error("Failed to save transaction:", err));

      return txn;
    },
    []
  );

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      setItem(KEYS.CACHE_TRANSACTIONS, updated);
      return updated;
    });

    fetch(`/api/transactions?id=${id}`, { method: "DELETE" }).catch((err) =>
      console.error("Failed to delete transaction:", err)
    );
  }, []);

  const getDailySummary = useCallback((): DailySummary => {
    return {
      totalSales: transactions.reduce((s, t) => s + t.total, 0),
      cashSales: transactions
        .filter((t) => t.paymentMode === "cash")
        .reduce((s, t) => s + t.total, 0),
      upiSales: transactions
        .filter((t) => t.paymentMode === "upi")
        .reduce((s, t) => s + t.total, 0),
      cardSales: transactions
        .filter((t) => t.paymentMode === "card")
        .reduce((s, t) => s + t.total, 0),
      totalItems: transactions.reduce(
        (s, t) => s + t.items.reduce((is, i) => is + i.quantity, 0),
        0
      ),
    };
  }, [transactions]);

  const getTransactionsByDate = useCallback(
    async (date: string): Promise<Transaction[]> => {
      try {
        const res = await fetch(`/api/transactions?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            sessionFetchedDates.add(date);
            return data;
          }
        }
      } catch (err) {
        console.error("Failed to fetch transactions by date:", err);
      }
      return [];
    },
    []
  );

  return {
    transactions,
    saveTransaction,
    deleteTransaction,
    getDailySummary,
    getTransactionsByDate,
    refreshTransactions: () => {
      const today = getTodayKey();
      fetch(`/api/transactions?date=${today}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTransactions(data);
            setItem(KEYS.CACHE_TRANSACTIONS, data);
          }
        })
        .catch(console.error);
    },
  };
}
