"use client";

import { useState, useEffect, useCallback } from "react";
import { Expense, ExpenseCategory } from "@/types";
import { getItem, setItem, KEYS, branchKey } from "@/lib/storage";
import { getTodayKey, generateId } from "@/lib/utils";

// In-memory flag so we only fetch expenses once per session
let sessionExpensesFetched = false;

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Load cached, then refresh from DB
  useEffect(() => {
    let cancelled = false;

    // 1. Instant load from cache
    const cached = getItem<Expense[]>(branchKey(KEYS.CACHE_EXPENSES));
    if (cached) setExpenses(cached);

    // 2. Skip DB refresh if we already fetched this session
    if (sessionExpensesFetched) return;

    // 3. Background refresh from DB
    fetch("/api/expenses")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setExpenses(data);
          setItem(branchKey(KEYS.CACHE_EXPENSES), data);
          sessionExpensesFetched = true;
        }
      })
      .catch((err) => console.error("Failed to load expenses:", err));

    return () => { cancelled = true; };
  }, []);

  const addExpense = useCallback(
    (data: Omit<Expense, "id" | "createdAt">) => {
      const newExpense: Expense = {
        ...data,
        id: generateId(),
        createdAt: Date.now(),
      };

      setExpenses((prev) => {
        const updated = [...prev, newExpense];
        setItem(branchKey(KEYS.CACHE_EXPENSES), updated);
        return updated;
      });

      fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExpense),
      }).catch((err) => console.error("Failed to save expense:", err));
    },
    []
  );

  const updateExpense = useCallback(
    (id: string, data: Partial<Omit<Expense, "id" | "createdAt">>) => {
      setExpenses((prev) => {
        const updated = prev.map((e) => (e.id === id ? { ...e, ...data } : e));
        setItem(branchKey(KEYS.CACHE_EXPENSES), updated);
        return updated;
      });
    },
    []
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setExpenses((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        setItem(branchKey(KEYS.CACHE_EXPENSES), updated);
        return updated;
      });

      fetch(`/api/expenses?id=${id}`, { method: "DELETE" }).catch((err) =>
        console.error("Failed to delete expense:", err)
      );
    },
    []
  );

  const getTodayExpenses = useCallback((): Expense[] => {
    const today = getTodayKey();
    return expenses.filter((e) => e.date === today);
  }, [expenses]);

  const getTotalToday = useCallback((): number => {
    return getTodayExpenses().reduce((sum, e) => sum + e.amount, 0);
  }, [getTodayExpenses]);

  const getExpensesByDate = useCallback(
    (date: string): Expense[] => {
      return expenses.filter((e) => e.date === date);
    },
    [expenses]
  );

  return {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    getTodayExpenses,
    getTotalToday,
    getExpensesByDate,
  };
}
