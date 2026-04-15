"use client";

import { useState } from "react";
import { useInventory } from "@/hooks/useInventory";
import { INVENTORY_UNITS, InventoryItem } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Pencil, Trash2, AlertTriangle, Package, Check, X, Search, Loader2 } from "lucide-react";
import { round2 } from "@/lib/utils";

function fmtQty(n: number) {
  const r = round2(n);
  return Number.isInteger(r) ? String(r) : String(r);
}

function InventoryForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<InventoryItem>;
  onSave: (data: Omit<InventoryItem, "id" | "createdAt">) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? INVENTORY_UNITS[0].value);
  const [currentStock, setCurrentStock] = useState(initial?.currentStock?.toString() ?? "0");
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.lowStockThreshold?.toString() ?? "5");
  const [error, setError] = useState("");

  function handleSave() {
    if (!name.trim()) return setError("Name is required");
    const stock = parseFloat(currentStock);
    const threshold = parseFloat(lowStockThreshold);
    if (isNaN(stock) || stock < 0) return setError("Invalid stock amount");
    if (isNaN(threshold) || threshold < 0) return setError("Invalid threshold amount");
    
    setError("");
    onSave({ 
      name: name.trim(), 
      unit, 
      currentStock: stock, 
      lowStockThreshold: threshold 
    });
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", opacity: isSaving ? 0.7 : 1 }}>
      <div className="space-y-3">
        <div>
           <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Item Name</label>
           <input
             type="text"
             value={name}
             disabled={isSaving}
             onChange={(e) => setName(e.target.value)}
             placeholder="e.g. Milk, Cheese, Pizza Base"
             className="w-full px-3 py-2.5 rounded-xl outline-none text-sm disabled:opacity-50"
             style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
           />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Unit</label>
            <select
              value={unit}
              disabled={isSaving}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl outline-none text-sm disabled:opacity-50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {INVENTORY_UNITS.map((u) => (
                <option key={u.value} value={u.value} style={{ background: "var(--bg-card)" }}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Current Stock</label>
            <input
              type="number"
              value={currentStock}
              disabled={isSaving}
              onChange={(e) => setCurrentStock(e.target.value)}
              placeholder="0.0"
              step="any"
              className="w-full px-3 py-2.5 rounded-xl outline-none text-sm disabled:opacity-50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Low Stock Alert Threshold</label>
            <input
              type="number"
              value={lowStockThreshold}
              disabled={isSaving}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              placeholder="5"
              step="any"
              className="w-full px-3 py-2.5 rounded-xl outline-none text-sm disabled:opacity-50"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Get alerted when stock falls to this amount.</p>
        </div>

        {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const {
    inventoryItems,
    lowStockItems,
    pendingOps,
    addItem,
    updateItem,
    deleteItem,
  } = useInventory();
  const perms = usePermissions("inventory");

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = inventoryItems.filter(item => 
     item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl flex items-start gap-3" style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }}>
           <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: "var(--red)" }} />
           <div>
             <h3 className="font-semibold text-sm" style={{ color: "var(--red)" }}>Low Stock Alert</h3>
             <p className="text-xs mt-1 text-red-700/80 dark:text-red-300/80">
               {lowStockItems.length} item{lowStockItems.length > 1 ? "s are" : " is"} running low. Please reorder soon.
             </p>
             <div className="flex flex-wrap gap-2 mt-2">
                {lowStockItems.slice(0, 3).map(item => (
                   <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: "var(--bg-card)", color: "var(--red)" }}>
                      {item.name} ({fmtQty(item.currentStock)} {item.unit})
                   </span>
                ))}
                {lowStockItems.length > 3 && (
                   <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: "transparent", color: "var(--red)" }}>
                      +{lowStockItems.length - 3} more
                   </span>
                )}
             </div>
           </div>
        </div>
      )}

      {/* Header & Search */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Package size={18} /> Raw Materials 
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
               {inventoryItems.length}
            </span>
          </h2>
          {perms.write && (
            <button
              onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <Plus size={14} /> Add Item
            </button>
          )}
        </div>

        <div className="relative">
           <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
           <input 
              type="text" 
              placeholder="Search inventory..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm transition-all shadow-sm"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <InventoryForm
          isSaving={Array.from(pendingOps).some(id => id.startsWith('temp_'))}
          onSave={(data) => {
            addItem(data);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Items List */}
      <div className="space-y-2">
        {filteredItems.length === 0 && !showAddForm && (
           <div className="py-12 text-center rounded-2xl" style={{ border: "1px dashed var(--border)" }}>
               <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
               <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No raw materials found</p>
               <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add items to track stock and calculate food costs</p>
           </div>
        )}

        {filteredItems.map(item => {
           const isLowStock = item.currentStock <= item.lowStockThreshold;

           return editingId === item.id ? (
             <InventoryForm
               key={item.id}
               initial={item}
               isSaving={pendingOps.has(item.id)}
               onSave={(data) => {
                 updateItem(item.id, data);
                 setEditingId(null);
               }}
               onCancel={() => setEditingId(null)}
             />
           ) : (
             <div 
               key={item.id} 
               className={`flex items-center justify-between p-3.5 rounded-2xl shadow-sm transition-all ${pendingOps.has(item.id) ? 'opacity-60' : ''}`}
               style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
             >
                <div className="flex-1 min-w-0 pr-3">
                   <div className="flex items-center gap-2 mb-0.5">
                       <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{item.name}</h3>
                       {isLowStock && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: "var(--red)" }} />
                       )}
                   </div>
                   <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                       <span className="font-medium" style={{ color: isLowStock ? "var(--red)" : "var(--green)" }}>
                         Stock: {fmtQty(item.currentStock)} {item.unit}
                       </span>
                       <span>Alert at: {fmtQty(item.lowStockThreshold)} {item.unit}</span>
                   </div>
                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                    {perms.write && (
                      <button
                        onClick={() => { setEditingId(item.id); setShowAddForm(false); }}
                        disabled={pendingOps.has(item.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {perms.delete && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${item.name}" from inventory? This removes it from all linked recipes.`)) {
                             deleteItem(item.id);
                          }
                        }}
                        disabled={pendingOps.has(item.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                        style={{ background: "var(--red-soft)", color: "var(--red)" }}
                      >
                        {pendingOps.has(item.id) ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    )}
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}
