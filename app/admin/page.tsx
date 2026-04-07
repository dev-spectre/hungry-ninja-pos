"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useProducts } from "@/hooks/useProducts";
import { useInventory } from "@/hooks/useInventory";
import { Product, InventoryItem } from "@/types";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Database,
  FileBarChart,
  Key,
} from "lucide-react";
import { getItem, setItem, KEYS } from "@/lib/storage";

function ProductForm({
  categories,
  inventoryItems,
  initial,
  onSave,
  onCancel,
}: {
  categories: { id: string; name: string }[];
  inventoryItems: InventoryItem[];
  initial?: Partial<Product>;
  onSave: (data: Omit<Product, "id" | "orderFrequency">, ingredients?: any[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(initial?.price?.toString() ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  
  // Ingredients state
  const [ingredients, setIngredients] = useState<{ inventoryItemId: string; quantityNeeded: string }[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(!!initial?.id);
  const [error, setError] = useState("");

  // Fetch existing ingredients if editing
  useEffect(() => {
    if (!initial?.id) return;
    fetch(`/api/products/ingredients?productId=${initial.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIngredients(data.map(d => ({
            inventoryItemId: d.inventoryItemId,
            quantityNeeded: d.quantityNeeded.toString()
          })));
        }
        setLoadingIngredients(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingIngredients(false);
      });
  }, [initial?.id]);

  function handleSave() {
    if (!name.trim()) return setError("Name is required");
    if (!price || isNaN(Number(price)) || Number(price) <= 0) return setError("Enter a valid price");
    
    // Validate ingredients (filter out incomplete ones, check numbers)
    const validIngredients = ingredients.filter(i => i.inventoryItemId.trim() !== "");
    for (const ing of validIngredients) {
       if (isNaN(Number(ing.quantityNeeded)) || Number(ing.quantityNeeded) <= 0) {
          return setError("Enter a valid quantity for all ingredients");
       }
    }

    setError("");
    
    const productData = { name: name.trim(), categoryId, price: Number(price), active };
    
    // We pass data to parent hook updater, then instantly close the form
    onSave(productData, validIngredients.map(i => ({ 
       inventoryItemId: i.inventoryItemId, 
       quantityNeeded: Number(i.quantityNeeded) 
    })));
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          className="w-full px-3 py-2.5 rounded-xl outline-none text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-3 py-2.5 rounded-xl outline-none text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id} style={{ background: "var(--bg-card)" }}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price ₹"
            className="px-3 py-2.5 rounded-xl outline-none text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Active (visible in billing)
        </label>
        
        {/* Ingredients Section */}
        {inventoryItems.length > 0 && (
          <div className="pt-2 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Recipe Ingredients (Optional)</label>
              <button 
                onClick={() => setIngredients([...ingredients, { inventoryItemId: "", quantityNeeded: "" }])}
                className="text-[10px] px-2 py-1 rounded-lg font-medium bg-blue-500/10 text-blue-500"
              >
                + Add Ingredient
              </button>
            </div>
            {loadingIngredients ? (
              <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)" }}>Loading recipe...</p>
            ) : ingredients.length === 0 ? (
              <p className="text-[10px] text-center italic py-1" style={{ color: "var(--text-muted)" }}>No raw materials linked.</p>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={ing.inventoryItemId}
                      onChange={(e) => {
                        const newIngs = [...ingredients];
                        newIngs[idx].inventoryItemId = e.target.value;
                        setIngredients(newIngs);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg outline-none text-xs"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    >
                      <option value="" disabled>Select material</option>
                      {inventoryItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      step="any"
                      value={ing.quantityNeeded}
                      onChange={(e) => {
                        const newIngs = [...ingredients];
                        newIngs[idx].quantityNeeded = e.target.value;
                        setIngredients(newIngs);
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg outline-none text-xs"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                    <span className="text-[10px] w-6 truncate" style={{ color: "var(--text-muted)" }}>
                       {inventoryItems.find(i => i.id === ing.inventoryItemId)?.unit ?? "-"}
                    </span>
                    <button 
                       onClick={() => {
                          const newIngs = [...ingredients];
                          newIngs.splice(idx, 1);
                          setIngredients(newIngs);
                       }}
                       className="p-1.5 rounded-lg text-red-500 hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Check size={14} /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

function CategorySection({
  categories,
  onAdd,
  onEdit,
  onDelete,
}: {
  categories: { id: string; name: string }[];
  onAdd: (name: string) => void;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newCat, setNewCat] = useState("");
  const [open, setOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  function handleAdd() {
    if (!newCat.trim()) return;
    onAdd(newCat.trim());
    setNewCat("");
  }

  function handleSaveEdit() {
    if (editingCatId && editingCatName.trim()) {
      onEdit(editingCatId, editingCatName.trim());
    }
    setEditingCatId(null);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          Categories ({categories.length})
        </span>
        {open ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex flex-col gap-2 pt-3">
            {categories.map((c) => (
              editingCatId === c.id ? (
                <div key={c.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={editingCatName}
                    onChange={(e) => setEditingCatName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl outline-none text-sm"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button onClick={handleSaveEdit} className="p-2 rounded-xl text-green-500 bg-green-500/10"><Check size={14} /></button>
                  <button onClick={() => setEditingCatId(null)} className="p-2 rounded-xl text-red-500 bg-red-500/10"><X size={14} /></button>
                </div>
              ) : (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "var(--accent-soft)" }}>
                  <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>{c.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }} className="p-1.5 rounded-lg text-blue-500 hover:bg-black/10 dark:hover:bg-white/10"><Pencil size={14} /></button>
                    <button onClick={() => { if (confirm(`Delete "${c.name}" category?`)) onDelete(c.id); }} className="p-1.5 rounded-lg text-red-500 hover:bg-black/10 dark:hover:bg-white/10"><Trash2 size={14} /></button>
                  </div>
                </div>
              )
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="New category name"
              className="flex-1 px-3 py-2 rounded-xl outline-none text-sm"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleActive,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useProducts();

  const { inventoryItems } = useInventory();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const visibleCategories = categories;

  const filtered = products.filter((p) => {
    const catMatch = filterCat === "all" || p.categoryId === filterCat;
    const activeMatch =
      filterActive === "all" ||
      (filterActive === "active" ? p.active : !p.active);
    return catMatch && activeMatch;
  });

  function handleChangePin() {
    const current = getItem<string>(KEYS.ADMIN_PIN) ?? "1234";
    const entered = prompt(`Current PIN (default: 1234):`);
    if (entered === null) return;
    if (entered !== current) { alert("Wrong PIN!"); return; }
    const newPin = prompt("Enter new PIN (digits only):");
    if (!newPin || !/^\d+$/.test(newPin)) { alert("Invalid PIN."); return; }
    setItem(KEYS.ADMIN_PIN, newPin);
    alert("PIN changed successfully!");
  }

  return (
    <div className="p-4 space-y-4">
      {/* Admin Quick Links */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/backup"
          className="flex flex-col items-center gap-1.5 p-3 rounded-2xl text-xs font-medium transition-all active:scale-95"
          style={{ background: "var(--green-soft)", color: "var(--green)" }}
        >
          <Database size={18} />
          Backup
        </Link>
        <Link
          href="/closing"
          className="flex flex-col items-center gap-1.5 p-3 rounded-2xl text-xs font-medium transition-all active:scale-95"
          style={{ background: "var(--purple-soft)", color: "var(--purple)" }}
        >
          <FileBarChart size={18} />
          Close Day
        </Link>
        <button
          onClick={handleChangePin}
          className="flex flex-col items-center gap-1.5 p-3 rounded-2xl text-xs font-medium transition-all active:scale-95"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Key size={18} />
          Change PIN
        </button>
      </div>

      {/* Payment Settings Section */}
      <div
        className="rounded-2xl overflow-hidden p-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <span className="font-semibold text-sm mb-3 block" style={{ color: "var(--text-primary)" }}>
          Payment Settings
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Receiver UPI ID (e.g. name@upi)"
            defaultValue={typeof window !== "undefined" ? getItem<string>(KEYS.UPI_ID) ?? "" : ""}
            onBlur={(e) => setItem(KEYS.UPI_ID, e.target.value.trim())}
            className="flex-1 px-3 py-2 rounded-xl outline-none text-sm"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Set this UPI ID to show a QR code for customers to scan during checkout. Leaves it blank to disable the QR popup.
        </p>
      </div>

      {/* Category Section */}
      <CategorySection
        categories={visibleCategories}
        onAdd={addCategory}
        onEdit={updateCategory}
        onDelete={deleteCategory}
      />

      {/* Product Management Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
          Products ({products.length})
        </h2>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus size={14} />
          Add Product
        </button>
      </div>

      {/* Add Product Form */}
      {showAddForm && (
        <ProductForm
          categories={visibleCategories}
          inventoryItems={inventoryItems}
          onSave={(data, ingredients) => {
            const tempId = Date.now().toString();
            const typedIngredients = ingredients?.map(i => ({
               id: Date.now().toString(),
               productId: tempId,
               inventoryItemId: i.inventoryItemId,
               quantityNeeded: i.quantityNeeded
            })) ?? [];
            
            // Instantly inject into cache; backend handles async
            addProduct({ ...data, id: tempId, ingredients: typedIngredients } as any);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs shrink-0 outline-none"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <option value="all">All Categories</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id} style={{ background: "var(--bg-card)" }}>
              {c.name}
            </option>
          ))}
        </select>
        {(["all", "active", "inactive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            className="px-3 py-1.5 rounded-xl text-xs shrink-0 capitalize font-medium transition-all"
            style={{
              background: filterActive === f ? "var(--accent)" : "var(--bg-elevated)",
              color: filterActive === f ? "#fff" : "var(--text-muted)",
              border: filterActive === f ? "none" : "1px solid var(--border)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Product List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            No products match the filter
          </p>
        )}
        {filtered.map((product) =>
          editingId === product.id ? (
            <ProductForm
              key={product.id}
              categories={visibleCategories}
              inventoryItems={inventoryItems}
              initial={product}
              onSave={(data: Omit<Product, "id" | "orderFrequency">, ingredients?: any[]) => {
                const typedIngredients = ingredients?.map(i => ({
                   id: Date.now().toString(),
                   productId: product.id,
                   inventoryItemId: i.inventoryItemId,
                   quantityNeeded: i.quantityNeeded
                })) ?? [];

                updateProduct(product.id, { ...data, ingredients: typedIngredients }); // updates client cache instantly
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={product.id}
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{
                background: "var(--bg-card)",
                border: product.active
                  ? "1px solid var(--border)"
                  : "1px solid var(--red-soft)",
                opacity: product.active ? 1 : 0.65,
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {product.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {categories.find((c) => c.id === product.categoryId)?.name} · ₹{product.price} · #{product.orderFrequency} orders
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleActive(product.id)}
                  title={product.active ? "Disable" : "Enable"}
                >
                  {product.active ? (
                    <ToggleRight size={24} style={{ color: "var(--green)" }} />
                  ) : (
                    <ToggleLeft size={24} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
                {/* Edit */}
                <button
                  onClick={() => { setEditingId(product.id); setShowAddForm(false); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Pencil size={13} />
                </button>
                {/* Delete */}
                <button
                  onClick={() => {
                    if (confirm(`Delete "${product.name}"?`)) deleteProduct(product.id);
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--red-soft)", color: "var(--red)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
