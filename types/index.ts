export type PaymentMode = "cash" | "upi" | "card";

export type PagePermissions = {
  read: boolean;
  write: boolean;
  delete: boolean;
};

export type UserPermissions = {
  billing?: PagePermissions;
  history?: PagePermissions;
  expenses?: PagePermissions;
  inventory?: PagePermissions;
  admin?: PagePermissions;
};


export type ExpenseCategory =
  | "raw_materials"
  | "salary"
  | "rent"
  | "utilities"
  | "packaging"
  | "maintenance"
  | "marketing"
  | "other";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "raw_materials", label: "Raw Materials" },
  { value: "salary", label: "Salary" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "packaging", label: "Packaging" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

export interface Category {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  active: boolean;
  orderFrequency: number;
  ingredients?: ProductIngredient[];
}

export interface BillItem {
  product: Product;
  quantity: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number; // Unix ms
  items: BillItemRecord[];
  total: number;
  paymentMode: PaymentMode;
}

export interface BillItemRecord {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export const INVENTORY_UNITS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "litre", label: "Litres (L)" },
  { value: "gm", label: "Grams (gm)" },
  { value: "ml", label: "Millilitres (ml)" },
] as const;

export type InventoryUnit = typeof INVENTORY_UNITS[number]["value"];

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  createdAt: number;
}

export interface ProductIngredient {
  id: string;
  productId: string;
  inventoryItemId: string;
  quantityNeeded: number;
  inventoryItem?: InventoryItem; // Optional populated field
}

export interface DailySummary {
  totalSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  totalItems: number;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: number; // Unix ms
}

export interface ProductSalesStat {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD
  archivedAt: number; // Unix ms
  openingCash: number;
  summary: DailySummary;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  transactions: Transaction[];
  expenses: Expense[];
}

export interface AppSettings {
  adminPin: string;
  darkMode: boolean;
  slowMovingThreshold: number; // sales count below which product is flagged
}
