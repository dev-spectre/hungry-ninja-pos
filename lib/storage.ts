// Generic localStorage helpers with SSR safety

export function getItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or private mode - silently fail
  }
}

export function removeItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

// Storage keys
export const KEYS = {
  // Cache keys (DB is source of truth, localStorage is fast cache)
  CACHE_PRODUCTS: "tst_cache_products",
  CACHE_CATEGORIES: "tst_cache_categories",
  CACHE_TRANSACTIONS: "tst_cache_transactions",
  CACHE_EXPENSES: "tst_cache_expenses",
  CACHE_INVENTORY: "tst_cache_inventory",
  // Device-local settings
  OPENING_CASH: "tst_opening_cash", // { date: string, amount: number }
  DARK_MODE: "tst_dark_mode", // boolean
  ADMIN_PIN: "tst_admin_pin", // string (default "1234")
  SLOW_MOVING_THRESHOLD: "tst_slow_threshold", // number (default 2)
  UPI_ID: "tst_upi_id", // string (UPI ID for QR)
} as const;
