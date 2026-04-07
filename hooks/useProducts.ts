"use client";

import { useState, useEffect, useCallback } from "react";
import { Category, Product } from "@/types";
import { getItem, setItem, KEYS } from "@/lib/storage";
import { generateId } from "@/lib/utils";

// In-memory flags to prevent redundant DB fetches across page navigations
let sessionProductsFetched = false;

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load cached data instantly, then refresh from DB
  useEffect(() => {
    let cancelled = false;

    // 1. Instant load from cache
    const cachedProducts = getItem<Product[]>(KEYS.CACHE_PRODUCTS);
    const cachedCategories = getItem<Category[]>(KEYS.CACHE_CATEGORIES);
    if (cachedProducts) setProducts(cachedProducts);
    if (cachedCategories) setCategories(cachedCategories);
    setInitialized(true);

    // 2. Skip DB refresh if we already fetched this session
    if (sessionProductsFetched) return;
    
    // 3. Background refresh from DB
    Promise.all([
      fetch("/api/products").then((r) => r.ok ? r.json() : null),
      fetch("/api/categories").then((r) => r.ok ? r.json() : null),
    ])
      .then(([prods, cats]) => {
        if (cancelled) return;
        let fetchedAny = false;
        if (Array.isArray(prods)) {
          setProducts(prods);
          setItem(KEYS.CACHE_PRODUCTS, prods);
          fetchedAny = true;
        }
        if (Array.isArray(cats)) {
          setCategories(cats);
          setItem(KEYS.CACHE_CATEGORIES, cats);
          fetchedAny = true;
        }
        if (fetchedAny) {
          sessionProductsFetched = true;
        }
      })
      .catch((err) => console.error("Failed to refresh products/categories:", err));

    return () => { cancelled = true; };
  }, []);

  const addProduct = useCallback(
    (data: Omit<Product, "id" | "orderFrequency">) => {
      const newProduct: Product = {
        ...data,
        id: generateId(),
        orderFrequency: 0,
      };

      setProducts((prev) => {
        const updated = [...prev, newProduct];
        setItem(KEYS.CACHE_PRODUCTS, updated);
        return updated;
      });

      fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      }).catch((err) => console.error("Failed to save product:", err));
    },
    []
  );

  const updateProduct = useCallback(
    (id: string, data: Partial<Omit<Product, "id">>) => {
      setProducts((prev) => {
        const updated = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
        setItem(KEYS.CACHE_PRODUCTS, updated);
        return updated;
      });

      fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      }).catch((err) => console.error("Failed to update product:", err));
    },
    []
  );

  const deleteProduct = useCallback(
    (id: string) => {
      setProducts((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        setItem(KEYS.CACHE_PRODUCTS, updated);
        return updated;
      });

      fetch(`/api/products?id=${id}`, { method: "DELETE" }).catch((err) =>
        console.error("Failed to delete product:", err)
      );
    },
    []
  );

  const toggleActive = useCallback(
    (id: string) => {
      setProducts((prev) => {
        const product = prev.find((p) => p.id === id);
        if (!product) return prev;
        const newActive = !product.active;

        fetch("/api/products", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, active: newActive }),
        }).catch((err) => console.error("Failed to toggle product:", err));

        const updated = prev.map((p) =>
          p.id === id ? { ...p, active: newActive } : p
        );
        setItem(KEYS.CACHE_PRODUCTS, updated);
        return updated;
      });
    },
    []
  );

  const incrementFrequency = useCallback(
    (productIds: string[]) => {
      setProducts((prev) => {
        const updates: { id: string; orderFrequency: number }[] = [];
        const updated = prev.map((p) => {
          if (productIds.includes(p.id)) {
            const newFreq = p.orderFrequency + 1;
            updates.push({ id: p.id, orderFrequency: newFreq });
            return { ...p, orderFrequency: newFreq };
          }
          return p;
        });

        setItem(KEYS.CACHE_PRODUCTS, updated);

        if (updates.length > 0) {
          const productIds = updates.map((u) => u.id);
          fetch("/api/products/bulk-frequency", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds }),
          }).catch((err) => console.error("Failed to bulk update frequency:", err));
        }

        return updated;
      });
    },
    []
  );

  const addCategory = useCallback(
    (name: string) => {
      const id = name.toLowerCase().replace(/\s+/g, "-");

      setCategories((prev) => {
        if (prev.some((c) => c.id === id)) return prev;
        const newCat: Category = { id, name };
        const updated = [...prev, newCat];
        setItem(KEYS.CACHE_CATEGORIES, updated);

        fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newCat),
        }).catch((err) => console.error("Failed to save category:", err));

        return updated;
      });
    },
    []
  );

  const updateCategory = useCallback(
    (id: string, name: string) => {
      setCategories((prev) => {
        const updated = prev.map((c) => (c.id === id ? { ...c, name } : c));
        setItem(KEYS.CACHE_CATEGORIES, updated);
        return updated;
      });

      fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      }).catch((err) => console.error("Failed to update category:", err));
    },
    []
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setCategories((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        setItem(KEYS.CACHE_CATEGORIES, updated);
        return updated;
      });
      setProducts((prev) => {
        const updated = prev.filter((p) => p.categoryId !== id);
        setItem(KEYS.CACHE_PRODUCTS, updated);
        return updated;
      });

      fetch(`/api/categories?id=${id}`, { method: "DELETE" }).catch((err) =>
        console.error("Failed to delete category:", err)
      );
    },
    []
  );

  const getProductsByCategory = useCallback(
    (categoryId: string) => {
      return products
        .filter(
          (p) =>
            p.active &&
            (categoryId === "__all__" || p.categoryId === categoryId)
        )
        .sort((a, b) => b.orderFrequency - a.orderFrequency);
    },
    [products]
  );

  return {
    products,
    categories,
    initialized,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleActive,
    incrementFrequency,
    addCategory,
    updateCategory,
    deleteCategory,
    getProductsByCategory,
  };
}
