"use client";

import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/types";
import { formatTime, formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { Trash2, ChevronDown, ChevronUp, Banknote, Smartphone, CreditCard, Clock } from "lucide-react";
import { useState, useEffect } from "react";

function PaymentBadge({ mode }: { mode: string }) {
  const config = {
    cash: { label: "Cash", color: "var(--green)", bg: "var(--green-soft)", icon: <Banknote size={12} /> },
    upi: { label: "UPI", color: "var(--yellow)", bg: "var(--yellow-soft)", icon: <Smartphone size={12} /> },
    card: { label: "Card", color: "var(--blue)", bg: "var(--blue-soft)", icon: <CreditCard size={12} /> },
  }[mode] ?? { label: mode, color: "var(--text-muted)", bg: "var(--bg-elevated)", icon: null };

  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: config.bg, color: config.color }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function TransactionCard({ txn, onDelete, canDelete }: { txn: Transaction; onDelete: () => void; canDelete: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Clock size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(txn.total)}
            </span>
            <PaymentBadge mode={txn.paymentMode} />
          </div>
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {txn.items.length} item{txn.items.length !== 1 ? "s" : ""} · {formatTime(txn.timestamp)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this transaction?")) onDelete();
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "var(--red-soft)", color: "var(--red)" }}
            >
              <Trash2 size={14} />
            </button>
          )}
          {expanded ? (
            <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="px-3 pb-3 space-y-1"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="pt-2">
            {txn.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {item.productName}
                  <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
                    × {item.quantity}
                  </span>
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
            <span className="text-base font-extrabold" style={{ color: "var(--accent)" }}>
              {formatCurrency(txn.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { transactions, deleteTransaction, getTransactionsByDate } = useTransactions();
  const perms = usePermissions("history");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [displayTransactions, setDisplayTransactions] = useState<Transaction[]>([]);

  // When date changes, fetch transactions
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    if (selectedDate === today) {
      setDisplayTransactions(transactions);
    } else {
      getTransactionsByDate(selectedDate).then(setDisplayTransactions);
    }
  }, [selectedDate, transactions, getTransactionsByDate]);

  const sorted = [...displayTransactions].sort((a, b) => b.timestamp - a.timestamp);
  const totalForDate = sorted.reduce((s, t) => s + t.total, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Date Picker Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Transaction History</h1>
        <input
          type="date"
          value={selectedDate}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            accentColor: "var(--accent)"
          }}
        />
      </div>

      {/* Header summary */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        }}
      >
        <div>
          <p className="text-white/70 text-xs font-medium">
            {selectedDate === new Date().toISOString().split("T")[0] ? "Today's Total" : "Total for " + selectedDate}
          </p>
          <p className="text-white text-2xl font-extrabold">{formatCurrency(totalForDate)}</p>
          <p className="text-white/60 text-xs">{sorted.length} transaction{sorted.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Transactions */}
      {sorted.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-16"
          style={{ color: "var(--text-muted)" }}
        >
          <Clock size={40} strokeWidth={1.2} />
          <p className="text-sm">No transactions on this date</p>
          <a href="/" className="text-xs" style={{ color: "var(--accent)" }}>
            Go to Billing →
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((txn) => (
            <TransactionCard
              key={txn.id}
              txn={txn}
              onDelete={() => deleteTransaction(txn.id)}
              canDelete={perms.delete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
