"use client";

import { useState } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { EXPENSE_CATEGORIES, Expense } from "@/types";
import { formatDate, getTodayKey } from "@/lib/utils";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  AlertCircle,
} from "lucide-react";

const categoryColors: Record<string, string> = {
  raw_materials: "var(--orange)",
  salary: "var(--blue)",
  rent: "var(--purple)",
  utilities: "var(--yellow)",
  packaging: "var(--green)",
  maintenance: "var(--red)",
  marketing: "var(--accent)",
  other: "var(--text-muted)",
};

export default function ExpensesPage() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(getTodayKey());

  const filtered = expenses.filter((e) => e.date === filterDate);
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  function getCatLabel(val: string) {
    return EXPENSE_CATEGORIES.find((c) => c.value === val)?.label ?? val;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Receipt size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-base leading-tight">
                {filterDate === getTodayKey() ? "Today's Expenses" : formatDate(filterDate)}
              </p>
              <p className="text-white/70 text-xs">{filtered.length} entries</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">Total</p>
            <p className="text-white font-bold text-lg">₹{total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Date Filter + Add Button */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-xl outline-none text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Add Form */}
      {showForm && !editingId && (
        <ExpenseForm
          onSave={(data) => { addExpense(data); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Expense List */}
      {filtered.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <AlertCircle size={32} style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No expenses for this date
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((expense) => (
            editingId === expense.id ? (
              <ExpenseForm
                key={expense.id}
                initial={expense}
                onSave={(data) => { updateExpense(expense.id, data); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={expense.id}
                className="flex items-start gap-3 p-3 rounded-2xl"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* Category Dot */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: categoryColors[expense.category] ?? "var(--text-muted)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {expense.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {getCatLabel(expense.category)}
                    {expense.notes ? ` · ${expense.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <p className="text-sm font-bold" style={{ color: "var(--orange)" }}>
                    ₹{expense.amount.toFixed(2)}
                  </p>
                  <button
                    onClick={() => { setEditingId(expense.id); setShowForm(false); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${expense.title}"?`)) deleteExpense(expense.id); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--red-soft)", color: "var(--red)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
