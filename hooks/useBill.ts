"use client";

import { useState, useCallback, useMemo } from "react";
import { BillItem, Product, PaymentMode, BillItemRecord } from "@/types";
import { round2 } from "@/lib/utils";

export function useBill() {
  const [items, setItems] = useState<BillItem[]>([]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.product.id === productId ? { ...i, quantity } : i
        )
      );
    }
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const clearBill = useCallback(() => {
    setItems([]);
  }, []);

  const grandTotal = useMemo(
    () => round2(items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)),
    [items]
  );

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const toBillRecords = useCallback((): BillItemRecord[] => {
    return items.map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      price: i.product.price,
      quantity: i.quantity,
      subtotal: round2(i.product.price * i.quantity),
    }));
  }, [items]);

  return {
    items,
    grandTotal,
    totalItems,
    addItem,
    updateQuantity,
    removeItem,
    clearBill,
    toBillRecords,
    isEmpty: items.length === 0,
  };
}
