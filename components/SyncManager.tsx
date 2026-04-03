"use client";

import { useEffect, useRef, useCallback } from "react";
import { getItem, setItem, KEYS } from "@/lib/storage";
import { Category, Product, Transaction, Expense, DailyReport } from "@/types";

export function SyncManager() {
  const syncInProgress = useRef(false);

  const attemptSync = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    syncInProgress.current = true;

    try {
      // 0. Pull initial data if localStorage is empty
      const txns = getItem<Transaction[]>(KEYS.TRANSACTIONS) ?? [];
      if (txns.length === 0) {
        const res = await fetch("/api/sync/transactions");
        if (res.ok) {
          const data = await res.json();
          if (data.transactions?.length > 0) {
            setItem(KEYS.TRANSACTIONS, data.transactions);
            window.dispatchEvent(new Event("syncRequested"));
          }
        }
      }

      const reports = getItem<DailyReport[]>(KEYS.ARCHIVED_REPORTS) ?? [];
      if (reports.length === 0) {
        const res = await fetch("/api/sync/reports");
        if (res.ok) {
          const data = await res.json();
          if (data.reports?.length > 0) {
            setItem(KEYS.ARCHIVED_REPORTS, data.reports);
            window.dispatchEvent(new Event("syncRequested"));
          }
        }
      }

      // --- PUSH PHASE ---
      
      // 1. Sync Categories (No relational dependencies)
      let allCategories = getItem<Category[]>(KEYS.CATEGORIES) ?? [];
      let pendingCategories = allCategories.filter((c) => c.syncStatus !== "synced").slice(0, 30);
      
      if (pendingCategories.length > 0) {
        const resCat = await fetch("/api/sync/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories: pendingCategories }),
        });
        if (resCat.ok) {
          const { syncedIds, deletedIds } = await resCat.json();
          const syncedIdsSet = new Set(syncedIds);
          const deletedIdsSet = new Set(deletedIds ?? []);
          // Remove confirmed-deleted items, mark synced items
          allCategories = allCategories
            .filter((c) => !deletedIdsSet.has(c.id))
            .map((c) =>
              syncedIdsSet.has(c.id) ? { ...c, syncStatus: "synced" as const } : c
            );
          setItem(KEYS.CATEGORIES, allCategories);
        }
      }

      // 2. Sync Products (Depends on Categories)
      let allProducts = getItem<Product[]>(KEYS.PRODUCTS) ?? [];
      let pendingProducts = allProducts.filter((p) => p.syncStatus !== "synced").slice(0, 30);

      if (pendingProducts.length > 0) {
        const resProd = await fetch("/api/sync/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: pendingProducts }),
        });
        if (resProd.ok) {
          const { syncedIds, deletedIds } = await resProd.json();
          const syncedIdsSet = new Set(syncedIds);
          const deletedIdsSet = new Set(deletedIds ?? []);
          allProducts = allProducts
            .filter((p) => !deletedIdsSet.has(p.id))
            .map((p) =>
              syncedIdsSet.has(p.id) ? { ...p, syncStatus: "synced" as const } : p
            );
          setItem(KEYS.PRODUCTS, allProducts);
        }
      }

      // 3. Sync Transactions (Depends on Products)
      let allTxns = getItem<Transaction[]>(KEYS.TRANSACTIONS) ?? [];
      let pendingTxns = allTxns.filter((t) => t.syncStatus !== "synced").slice(0, 20);

      if (pendingTxns.length > 0) {
        const resTxn = await fetch("/api/sync/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: pendingTxns }),
        });

        if (resTxn.ok) {
          const { syncedIds, deletedIds } = await resTxn.json();
          const syncedIdsSet = new Set(syncedIds);
          const deletedIdsSet = new Set(deletedIds ?? []);
          allTxns = allTxns
            .filter((t) => !deletedIdsSet.has(t.id))
            .map((t) =>
              syncedIdsSet.has(t.id) ? { ...t, syncStatus: "synced" as const } : t
            );
          setItem(KEYS.TRANSACTIONS, allTxns);
        }
      }

      // 4. Sync Expenses (Independent)
      let allExpenses = getItem<Expense[]>(KEYS.EXPENSES) ?? [];
      let pendingExpenses = allExpenses.filter((e) => e.syncStatus !== "synced").slice(0, 30);

      if (pendingExpenses.length > 0) {
        const resExp = await fetch("/api/sync/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenses: pendingExpenses }),
        });

        if (resExp.ok) {
          const { syncedIds, deletedIds } = await resExp.json();
          const syncedIdsSet = new Set(syncedIds);
          const deletedIdsSet = new Set(deletedIds ?? []);
          allExpenses = allExpenses
            .filter((e) => !deletedIdsSet.has(e.id))
            .map((e) =>
              syncedIdsSet.has(e.id) ? { ...e, syncStatus: "synced" as const } : e
            );
          setItem(KEYS.EXPENSES, allExpenses);
        }
      }

      // 5. Sync Daily Reports (Archived history)
      let allReports = getItem<DailyReport[]>(KEYS.ARCHIVED_REPORTS) ?? [];
      let pendingReports = allReports.filter((r) => r.syncStatus !== "synced").slice(0, 10);

      if (pendingReports.length > 0) {
        const resRep = await fetch("/api/sync/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reports: pendingReports }),
        });

        if (resRep.ok) {
          const { syncedIds } = await resRep.json();
          const syncedIdsSet = new Set(syncedIds);
          allReports = allReports.map((r: typeof allReports[0]) =>
            syncedIdsSet.has(r.id) ? { ...r, syncStatus: "synced" as const } : r
          );
          setItem(KEYS.ARCHIVED_REPORTS, allReports);
        }
      }

      // --- PULL PHASE ---
      // Fetch latest from DB to keep all devices in sync
      const pullReqs = await Promise.allSettled([
        fetch("/api/sync/categories").then((r) => r.json()),
        fetch("/api/sync/products").then((r) => r.json()),
        fetch("/api/sync/transactions").then((r) => r.json()),
        fetch("/api/sync/expenses").then((r) => r.json()),
        fetch("/api/sync/reports").then((r) => r.json()),
      ]);

      let dispatchNeeded = false;

      // Helper to merge local pending items with live server items
      const mergeArrays = <T extends { id: string; syncStatus?: string }>(
        localArray: T[],
        serverArray: T[]
      ): T[] => {
        const pendingItems = localArray.filter((i) => i.syncStatus !== "synced");
        const pendingIds = new Set(pendingItems.map((i) => i.id));
        const filteredServerItems = serverArray.filter((i) => !pendingIds.has(i.id));
        return [...pendingItems, ...filteredServerItems];
      };

      // 1. Categories
      if (pullReqs[0].status === "fulfilled" && pullReqs[0].value.success) {
        const serverCategories = pullReqs[0].value.categories;
        const newCategories = mergeArrays(allCategories, serverCategories);
        if (JSON.stringify(newCategories) !== JSON.stringify(allCategories)) {
          setItem(KEYS.CATEGORIES, newCategories);
          dispatchNeeded = true;
        }
      }

      // 2. Products
      if (pullReqs[1].status === "fulfilled" && pullReqs[1].value.success) {
        const serverProducts = pullReqs[1].value.products;
        const newProducts = mergeArrays(allProducts, serverProducts);
        if (JSON.stringify(newProducts) !== JSON.stringify(allProducts)) {
          setItem(KEYS.PRODUCTS, newProducts);
          dispatchNeeded = true;
        }
      }

      // 3. Transactions
      if (pullReqs[2].status === "fulfilled" && pullReqs[2].value.success) {
        const serverTransactions = pullReqs[2].value.transactions;
        const newTransactions = mergeArrays(allTxns, serverTransactions);
        if (JSON.stringify(newTransactions) !== JSON.stringify(allTxns)) {
          setItem(KEYS.TRANSACTIONS, newTransactions);
          dispatchNeeded = true;
        }
      }

      // 4. Expenses
      if (pullReqs[3].status === "fulfilled" && pullReqs[3].value.success) {
        const serverExpenses = pullReqs[3].value.expenses;
        const newExpenses = mergeArrays(allExpenses, serverExpenses);
        if (JSON.stringify(newExpenses) !== JSON.stringify(allExpenses)) {
          setItem(KEYS.EXPENSES, newExpenses);
          dispatchNeeded = true;
        }
      }

      // 5. Reports
      if (pullReqs[4].status === "fulfilled" && pullReqs[4].value.success) {
        const serverReports = pullReqs[4].value.reports;
        const newReports = mergeArrays(allReports, serverReports);
        if (JSON.stringify(newReports) !== JSON.stringify(allReports)) {
          setItem(KEYS.ARCHIVED_REPORTS, newReports);
          dispatchNeeded = true;
        }
      }

      if (dispatchNeeded) {
        window.dispatchEvent(new Event("syncRequested"));
      }

    } catch (error) {
      console.error("SyncManager: Sync failed", error);
    } finally {
      syncInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const debouncedSync = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(attemptSync, 2000);
    };

    // Attempt sync on mount
    debouncedSync();

    // Listen for online events
    window.addEventListener("online", debouncedSync);

    // Listen for manual sync triggers from hooks
    window.addEventListener("syncRequested", debouncedSync);

    // Periodic background sync every 60 seconds
    const intervalId = setInterval(debouncedSync, 60_000);

    return () => {
      window.removeEventListener("online", debouncedSync);
      window.removeEventListener("syncRequested", debouncedSync);
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [attemptSync]);

  return null; // Silent logic-only component
}
