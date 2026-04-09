"use client";

import { useState, useEffect } from "react";
import { Package, AlertTriangle, Building2 } from "lucide-react";

interface GlobalInventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  branch: { name: string; id: string };
  createdAt: number;
}

export default function GlobalInventory() {
  const [items, setItems] = useState<GlobalInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalInventory();
  }, []);

  const fetchGlobalInventory = async () => {
    try {
      const res = await fetch("/api/inventory?global=true");
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const lowStockItems = items.filter(i => i.currentStock <= i.lowStockThreshold);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
         <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="text-(--accent)" /> 
            Global Inventory
         </h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="p-4 rounded-xl border border-(--border) bg-(--bg-card) flex flex-col items-center justify-center">
            <h3 className="text-2xl font-bold">{items.length}</h3>
            <p className="text-sm text-(--text-muted) font-medium">Tracked Items</p>
         </div>
         <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 flex flex-col items-center justify-center">
            <h3 className="text-2xl font-bold text-red-500">{lowStockItems.length}</h3>
            <p className="text-sm text-red-500/80 font-medium flex items-center gap-1"><AlertTriangle size={14}/> Low Stock Alerts</p>
         </div>
      </div>

      <div className="space-y-4">
         <h2 className="text-lg font-bold">Needs Attention</h2>
         {lowStockItems.length === 0 ? (
            <p className="text-sm text-(--text-muted)">All branches are well-stocked.</p>
         ) : (
            <div className="space-y-2">
              {lowStockItems.map(item => (
                 <div key={item.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center justify-between">
                    <div>
                       <h3 className="font-bold text-red-500">{item.name}</h3>
                       <p className="text-xs text-red-500/70 font-medium flex items-center gap-1 mt-0.5">
                          <Building2 size={12} /> {item.branch.name}
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-red-500">{item.currentStock} <span className="text-xs font-medium">{item.unit}</span></p>
                       <p className="text-[10px] text-red-500/70">Threshold: {item.lowStockThreshold}</p>
                    </div>
                 </div>
              ))}
            </div>
         )}
      </div>

      <div className="space-y-4">
         <h2 className="text-lg font-bold">All Inventory</h2>
         {loading ? (
            <p className="text-sm text-(--text-muted)">Loading global ledger...</p>
         ) : (
            <div className="space-y-2">
              {items.map(item => {
                 const isLow = item.currentStock <= item.lowStockThreshold;
                 return (
                 <div key={item.id} className={`p-4 bg-(--bg-card) border border-(--border) rounded-xl flex items-center justify-between ${isLow ? 'opacity-50' : ''}`}>
                    <div>
                       <h3 className="font-bold">{item.name}</h3>
                       <p className="text-xs text-(--text-muted) font-medium flex items-center gap-1 mt-0.5">
                          <Building2 size={12} /> {item.branch.name}
                       </p>
                    </div>
                    <div className="text-right">
                       <p className={`text-sm font-bold ${isLow ? 'text-red-500' : 'text-(--text-primary)'}`}>
                          {item.currentStock} <span className="text-xs font-medium">{item.unit}</span>
                       </p>
                       <p className="text-[10px] text-(--text-muted)">Threshold: {item.lowStockThreshold}</p>
                    </div>
                 </div>
                 )
              })}
            </div>
         )}
      </div>

    </div>
  );
}
