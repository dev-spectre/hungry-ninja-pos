"use client";

import { useState, useEffect, useCallback } from "react";
import { InventoryItem } from "@/types";
import { getItem, setItem, KEYS, branchKey } from "@/lib/storage";
import { generateId } from "@/lib/utils";

let sessionInventoryFetched = false;

export function useInventory() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1. Instant load from cache
    const cached = getItem<InventoryItem[]>(branchKey(KEYS.CACHE_INVENTORY));
    if (cached) setInventoryItems(cached);
    setInitialized(true);

    // 2. Skip DB refresh if fetched this session
    if (sessionInventoryFetched) return;

    // Background refresh from DB
    fetch("/api/inventory")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setInventoryItems(data);
          setItem(branchKey(KEYS.CACHE_INVENTORY), data);
          sessionInventoryFetched = true;
        }
      })
      .catch((err) => console.error("Failed to load inventory:", err));

    const handleLocalUpdate = () => {
      const cached = getItem<InventoryItem[]>(branchKey(KEYS.CACHE_INVENTORY));
      if (cached) setInventoryItems(cached);
    };

    if (typeof window !== "undefined") {
      window.addEventListener(`storage-${KEYS.CACHE_INVENTORY}`, handleLocalUpdate);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(`storage-${KEYS.CACHE_INVENTORY}`, handleLocalUpdate);
      }
    };
  }, []);

  const addItem = useCallback((data: Omit<InventoryItem, "id" | "createdAt">) => {
    const newItem: InventoryItem = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
    };

    setInventoryItems((prev) => {
      const updated = [...prev, newItem];
      setItem(branchKey(KEYS.CACHE_INVENTORY), updated);
      return updated;
    });

    fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    }).catch((err) => console.error("Failed to save inventory item:", err));
  }, []);

  const updateItem = useCallback((id: string, data: Partial<Omit<InventoryItem, "id">>) => {
    setInventoryItems((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...data } : item));
      setItem(branchKey(KEYS.CACHE_INVENTORY), updated);
      return updated;
    });

    fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    }).catch((err) => console.error("Failed to update inventory item:", err));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setInventoryItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      setItem(branchKey(KEYS.CACHE_INVENTORY), updated);
      return updated;
    });

    fetch(`/api/inventory?id=${id}`, { method: "DELETE" }).catch((err) =>
      console.error("Failed to delete inventory item:", err)
    );
  }, []);

  const deductStock = useCallback((sales: { product: any; quantity: number }[]) => {
    // Optimistic immediate UI update
    setInventoryItems((prev) => {
      let optimistics = [...prev];
      for (const sale of sales) {
        if (sale.product.ingredients) {
          for (const ing of sale.product.ingredients) {
            const idx = optimistics.findIndex((i) => i.id === ing.inventoryItemId);
            if (idx !== -1) {
              optimistics[idx] = {
                ...optimistics[idx],
                currentStock: optimistics[idx].currentStock - (ing.quantityNeeded * sale.quantity)
              };
            }
          }
        }
      }
      setItem(branchKey(KEYS.CACHE_INVENTORY), optimistics);
      return optimistics;
    });

    // Send payload to backend exactly as it expects
    const payloadSales = sales.map(s => ({ productId: s.product.id, quantity: s.quantity }));

    fetch("/api/inventory/deduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales: payloadSales }),
    })
      .then((res) => {
        if (res.ok) {
          res.json().then((updatedItems) => {
             if (Array.isArray(updatedItems)) {
                setItem(branchKey(KEYS.CACHE_INVENTORY), updatedItems);
             }
          });
        }
      })
      .catch((err) => console.error("Failed to deduct stock:", err));
  }, []);

  const lowStockItems = inventoryItems.filter(
    (item) => item.currentStock <= item.lowStockThreshold
  );

  return {
    inventoryItems,
    lowStockItems,
    initialized,
    addItem,
    updateItem,
    deleteItem,
    deductStock,
  };
}
