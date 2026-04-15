"use client";

import { useState, useCallback, useEffect } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useBill } from "@/hooks/useBill";
import { useTransactions } from "@/hooks/useTransactions";
import { useInventory } from "@/hooks/useInventory";
import { usePermissions } from "@/hooks/usePermissions";
import { PaymentMode, Product } from "@/types";
import CategoryTabs from "@/components/billing/CategoryTabs";
import SearchBar from "@/components/billing/SearchBar";
import ProductCard from "@/components/billing/ProductCard";
import BillPanel from "@/components/billing/BillPanel";
import PaymentButtons from "@/components/billing/PaymentButtons";
import { CheckCircle, X, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getItem, KEYS } from "@/lib/storage";

type TableOrderItem = {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;
};
type TableOrder = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BILLED";
  transactionId?: string | null;
  totalAmount: number;
  createdAt: string;
  table: { id: string; name: string };
  items: TableOrderItem[];
};

export default function BillingPage() {
  const { products, categories, initialized, getProductsByCategory, incrementFrequency } = useProducts();
  const { items, grandTotal, addItem, updateQuantity, removeItem, clearBill, toBillRecords, isEmpty } = useBill();
  const { saveTransaction } = useTransactions();
  const { deductStock } = useInventory();
  const perms = usePermissions("billing");

  const [activeCategoryId, setActiveCategoryId] = useState<string>("__all__");
  const [toast, setToast] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [upiId, setUpiId] = useState<string>("");

  const [tableOrdersOpen, setTableOrdersOpen] = useState(false);
  const [tableOrdersLoading, setTableOrdersLoading] = useState(false);
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
  const [activeTableOrderId, setActiveTableOrderId] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    // Load UPI ID if configured
    setUpiId(getItem<string>(KEYS.UPI_ID) ?? "");
  }, []);

  // Use initialized categories
  const displayCategories = categories.length > 0 ? [{ id: "__all__", name: "All" }, ...categories] : [{ id: "__all__", name: "All" }];

  // Ensure activeCategoryId is valid
  const resolvedCategoryId = displayCategories.find((c) => c.id === activeCategoryId)?.id ?? displayCategories[0]?.id ?? "starters";

  const activeProducts = initialized ? getProductsByCategory(resolvedCategoryId) : [];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const completePayment = useCallback(
    (mode: PaymentMode) => {
      if (processingPayment) return;
      setProcessingPayment(true);
      
      const records = toBillRecords();
      const txn = saveTransaction(records, grandTotal, mode);
      const ids = items.map((i) => i.product.id);
      incrementFrequency(ids);
      
      // Deduct inventory stock only for non-table orders.
      // Table orders are deducted when Kitchen ACCEPTS.
      if (!activeTableOrderId) {
        deductStock(items.map((i) => ({ product: i.product, quantity: i.quantity })));
      }
      
      if (activeTableOrderId) {
        fetch(`/api/kitchen/orders/${encodeURIComponent(activeTableOrderId)}/bill`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: txn.id }),
        }).catch(() => {});
        setActiveTableOrderId(null);
      }

      setTimeout(() => {
        clearBill();
        setBillOpen(false);
        setShowUpiQr(false);
        setProcessingPayment(false);
        showToast(`₹${grandTotal.toFixed(2)} paid via ${mode.toUpperCase()} ✓`);
      }, 300);
    },
    [toBillRecords, saveTransaction, grandTotal, items, incrementFrequency, deductStock, clearBill, showToast, activeTableOrderId, processingPayment],
  );

  const handlePay = useCallback(
    (mode: PaymentMode) => {
      if (isEmpty) return;
      if (mode === "upi" && upiId) {
        setShowUpiQr(true);
      } else {
        completePayment(mode);
      }
    },
    [isEmpty, completePayment, upiId],
  );

  const getQuantityInBill = (productId: string) => items.find((i) => i.product.id === productId)?.quantity ?? 0;

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const qrValue = `upi://pay?pa=${upiId}&pn=Merchant&am=${grandTotal.toFixed(2)}&cu=INR`;

  const openTableOrders = useCallback(async () => {
    setTableOrdersOpen(true);
    setTableOrdersLoading(true);
    try {
      const res = await fetch("/api/kitchen/orders?status=ACCEPTED");
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setTableOrders(data);
      } else {
        setTableOrders([]);
      }
    } finally {
      setTableOrdersLoading(false);
    }
  }, []);

  const loadTableOrder = useCallback(
    (order: TableOrder) => {
      clearBill();
      for (const line of order.items) {
        const product: Product = {
          id: line.productId,
          name: line.productName,
          price: line.productPrice,
          categoryId: "",
          active: true,
          orderFrequency: 0,
        };
        addItem(product);
        updateQuantity(product.id, line.quantity);
      }
      setActiveTableOrderId(order.id);
      setTableOrdersOpen(false);
      setBillOpen(true);
    },
    [addItem, clearBill, updateQuantity],
  );

  return (
    <div className="flex flex-col h-full relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-14 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl animate-pulse" style={{ background: "var(--green)", color: "#fff", maxWidth: "90vw" }}>
            <CheckCircle size={18} />
            <span className="font-semibold text-sm">{toast}</span>
          </div>
        </div>
      )}

      {/* UPI QR Code Modal */}
      {showUpiQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">Scan to Pay</h3>
            <p className="text-gray-500 font-medium text-sm mb-6">via any UPI App</p>

            <div className="bg-white p-3 rounded-2xl shadow-sm border-2 border-slate-100 mb-6">
              <QRCodeSVG value={qrValue} size={200} level="M" />
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-4 mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 text-sm font-medium">Amount</span>
                <span className="text-xl font-extrabold text-slate-800">₹{grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm font-medium">To</span>
                <span className="text-sm font-semibold text-slate-700 truncate max-w-[150px]">{upiId}</span>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button onClick={() => setShowUpiQr(false)} className="flex-1 py-3.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => completePayment("upi")}
                disabled={processingPayment}
                className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                {processingPayment ? <Loader2 size={18} className="animate-spin" /> : null}
                {processingPayment ? "Processing..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Orders Modal */}
      {tableOrdersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl shadow-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>Table Orders</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Accepted orders waiting for billing</div>
              </div>
              <button
                onClick={() => setTableOrdersOpen(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {tableOrdersLoading ? (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
              ) : tableOrders.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>No table orders right now.</div>
              ) : (
                <div className="space-y-3">
                  {tableOrders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => loadTableOrder(o)}
                      className="w-full text-left rounded-2xl p-4 border transition-all active:scale-[0.99]"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>{o.table?.name ?? "Table"}</div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {o.items.reduce((s, i) => s + i.quantity, 0)} items • ₹{o.totalAmount}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold px-3 py-1 rounded-full" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                          Accepted
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Section */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Table Orders Button */}
        <div className="px-4 pt-3">
          <button
            onClick={openTableOrders}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl font-extrabold text-sm"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <span>Table Orders</span>
            {activeTableOrderId ? (
              <span className="text-xs font-extrabold px-3 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                Loaded
              </span>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>View →</span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="pt-2">
          <SearchBar products={products.filter((p) => p.active)} onSelect={(p: Product) => addItem(p)} />
        </div>

        {/* Category Tabs */}
        <CategoryTabs categories={displayCategories} activeId={resolvedCategoryId} onSelect={setActiveCategoryId} />

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {activeProducts.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm" style={{ color: "var(--text-muted)" }}>
              No active products in this category
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {activeProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addItem} quantity={getQuantityInBill(product.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bill Sheet Trigger */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        {!billOpen ? (
          <button
            onClick={() => setBillOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: isEmpty ? "var(--bg-elevated)" : "var(--accent)",
              color: isEmpty ? "var(--text-muted)" : "#fff",
              border: isEmpty ? "1px solid var(--border)" : "none",
            }}>
            <span>{isEmpty ? "No items in bill" : `View Bill (${totalItems} items)`}</span>
            {!isEmpty && <span className="font-extrabold">₹{grandTotal.toFixed(2)}</span>}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Current Bill
              </h3>
              <button onClick={() => setBillOpen(false)} className="text-xs" style={{ color: "var(--text-muted)" }}>
                ▲ Collapse
              </button>
            </div>
            <BillPanel items={items} grandTotal={grandTotal} onUpdateQty={updateQuantity} onRemove={perms.delete ? removeItem : () => {}} onClear={perms.delete ? clearBill : () => {}} />
            {perms.write && <PaymentButtons onPay={handlePay} disabled={isEmpty || processingPayment} />}
          </div>
        )}
      </div>
    </div>
  );
}
