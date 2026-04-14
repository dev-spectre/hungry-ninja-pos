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

// ── Branch-scoped key helper ─────────────────────────────────
// Prefixes cache keys with the active branch ID so data from
// one POS branch is never leaked into another.
function getActiveBranchId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("active_branch_id") || "";
}

export function branchKey(key: string): string {
  const bid = getActiveBranchId();
  return bid ? `${key}_${bid}` : key;
}

// Clear ALL branch-scoped cache entries (call on branch switch / logout)
export function clearBranchCache(): void {
  if (typeof window === "undefined") return;
  const bid = getActiveBranchId();
  const baseKeys = [
    KEYS.CACHE_PRODUCTS,
    KEYS.CACHE_CATEGORIES,
    KEYS.CACHE_TRANSACTIONS,
    KEYS.CACHE_EXPENSES,
    KEYS.CACHE_INVENTORY,
    KEYS.OPENING_CASH,
  ];
  // Clear both raw and branch-scoped keys
  for (const k of baseKeys) {
    localStorage.removeItem(k);
    if (bid) localStorage.removeItem(`${k}_${bid}`);
  }
  // Also clear any other branch-prefixed keys
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("tst_cache_")) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
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

