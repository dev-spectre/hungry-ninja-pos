"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, ClipboardList, Clock, Minus, Plus, ShoppingCart, Swords, Trash2 } from "lucide-react";

type MenuCategory = { id: string; name: string };
type MenuProduct = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName?: string | null;
};
type MenuResponse = {
  table: { id: string; name: string; branchId: string };
  categories: MenuCategory[];
  products: MenuProduct[];
};

type CartLine = { product: MenuProduct; quantity: number };

export default function PublicOrderClient({ qrToken }: { qrToken: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("__all__");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  const [customerOrders, setCustomerOrders] = useState<
    Array<{
      orderId: string;
      createdAt: number;
      status: "PENDING" | "ACCEPTED" | "REJECTED" | "BILLED";
      items: Array<{ productId: string; name: string; price: number; quantity: number; subtotal: number }>;
      total: number;
      notes?: string;
    }>
  >([]);

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMenu(null);

    fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Invalid or inactive table QR" : "Failed to load menu");
        return (await r.json()) as MenuResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setMenu(data);
        setLoading(false);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load menu");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  const categories = useMemo(() => {
    const base = menu?.categories ?? [];
    return [{ id: "__all__", name: "All" }, ...base];
  }, [menu]);

  const products = useMemo(() => menu?.products ?? [], [menu]);

  const filteredProducts = useMemo(() => {
    if (activeCategoryId === "__all__") return products;
    return products.filter((p) => p.categoryId === activeCategoryId);
  }, [products, activeCategoryId]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const totalItems = useMemo(() => cartLines.reduce((s, l) => s + l.quantity, 0), [cartLines]);
  const totalAmount = useMemo(() => cartLines.reduce((s, l) => s + l.product.price * l.quantity, 0), [cartLines]);

  const add = (p: MenuProduct) => {
    setCart((prev) => {
      const next = { ...prev };
      const existing = next[p.id];
      next[p.id] = { product: p, quantity: (existing?.quantity ?? 0) + 1 };
      return next;
    });
  };

  const dec = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      const existing = next[productId];
      if (!existing) return prev;
      const q = existing.quantity - 1;
      if (q <= 0) delete next[productId];
      else next[productId] = { ...existing, quantity: q };
      return next;
    });
  };

  const inc = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      const existing = next[productId];
      if (!existing) return prev;
      next[productId] = { ...existing, quantity: existing.quantity + 1 };
      return next;
    });
  };

  const remove = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const placeOrder = async () => {
    if (placing) return;
    if (cartLines.length === 0) return;

    setPlacing(true);
    setError(null);
    try {
      const snapshotItems = cartLines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        price: l.product.price,
        quantity: l.quantity,
        subtotal: l.product.price * l.quantity,
      }));

      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken,
          items: cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          notes: notes.trim() ? notes.trim().slice(0, 200) : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Failed to place order");
      }
      const j = (await res.json().catch(() => null)) as any;
      const orderId = typeof j?.orderId === "string" ? j.orderId : "";
      if (!orderId) throw new Error("Order placed but missing orderId");

      setCustomerOrders((prev) => [
        {
          orderId,
          createdAt: Date.now(),
          status: "PENDING",
          items: snapshotItems,
          total: snapshotItems.reduce((s, i) => s + i.subtotal, 0),
          notes: notes.trim() ? notes.trim().slice(0, 200) : undefined,
        },
        ...prev,
      ]);

      setCart({});
      setNotes("");
      setDrawerOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  // Customer live status via WebSocket (join by branchId from menu)
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const branchId = menu?.table?.branchId;
    if (!wsUrl || !branchId) return;

    let alive = true;
    let ws: WebSocket | null = null;
    let retry = 0;
    const MAX_RETRIES = 3;

    const connect = () => {
      if (!alive || retry >= MAX_RETRIES) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        return; // invalid URL, give up silently
      }
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        ws?.send(JSON.stringify({ type: "JOIN", branchId }));
      };

      ws.onmessage = (ev) => {
        const raw = typeof ev.data === "string" ? ev.data : "";
        try {
          const msg = JSON.parse(raw) as any;
          if (msg?.type === "ORDER_UPDATED" && typeof msg.orderId === "string" && typeof msg.status === "string") {
            setCustomerOrders((prev) =>
              prev.map((o) => (o.orderId === msg.orderId ? { ...o, status: msg.status } : o)),
            );
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!alive) return;
        const delay = Math.min(5_000, 1000 * Math.pow(1.5, retry++));
        setTimeout(() => connect(), delay);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // ignore
        }
      };
    };

    connect();
    return () => {
      alive = false;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [menu?.table?.branchId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0b0b0b", color: "#fff" }}>
        <div className="w-full max-w-sm rounded-3xl border p-6 text-center" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
          <div className="text-lg font-extrabold">Hungry Ninja</div>
          <div className="mt-2 text-sm opacity-80">Loading menu…</div>
        </div>
      </div>
    );
  }

  // stay on menu after placing; show status card instead of replacing page

  if (!menu || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0b0b0b", color: "#fff" }}>
        <div className="w-full max-w-sm rounded-3xl border p-7" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
          <div className="text-xl font-extrabold mb-2">QR not valid</div>
          <div className="text-sm opacity-80">{error ?? "Unknown error"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0b0b0b", color: "#fff" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% 0%, rgba(230,57,70,0.10), transparent 55%), radial-gradient(900px 900px at 20% 30%, rgba(255,255,255,0.05), transparent 60%), radial-gradient(900px 900px at 80% 60%, rgba(255,255,255,0.04), transparent 60%)",
        }}
      />

      <header
        className="sticky top-0 z-30 px-4 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(11,11,11,0.92)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold shadow-sm" style={{ background: "#e63946", color: "#fff" }}>
              <Swords size={18} />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-base tracking-wide">Hungry Ninja</div>
              <div className="text-xs opacity-70">Scan • Order • Relax</div>
            </div>
          </div>
          <div className="text-sm font-extrabold">
            <span className="opacity-70">Table</span>{" "}
            <span className="opacity-95">{menu.table.name.replace(/^Table\\s*/i, "")}</span>
          </div>
        </div>
      </header>

      <div className="relative px-4 pt-4">
        <div className="max-w-3xl mx-auto">
        <div
          className="rounded-3xl border overflow-hidden"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background:
              "linear-gradient(135deg, rgba(230,57,70,0.25), rgba(255,255,255,0.02) 55%), radial-gradient(800px 200px at 80% 20%, rgba(230,57,70,0.25), transparent 60%)",
          }}
        >
          <div className="p-5">
            <div className="text-[12px] font-semibold opacity-75">TODAY’S MENU</div>
            <div className="mt-1 text-xl font-extrabold leading-tight">
              Fresh, fast, and spicy.
              <br />
              Delivered to your table.
            </div>
            <div className="mt-3 text-sm opacity-80">Tap items to add • Review cart • Place order</div>
          </div>
        </div>
        </div>
      </div>

      {/* Customer order status */}
      {customerOrders.length > 0 ? (
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
          <div
            className="rounded-3xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} />
                <div className="font-extrabold">Your Order</div>
              </div>
              <div
                className="text-xs font-extrabold px-3 py-1 rounded-full"
                style={{
                  background:
                    customerOrders[0].status === "ACCEPTED"
                      ? "rgba(34,197,94,0.18)"
                      : customerOrders[0].status === "REJECTED"
                        ? "rgba(239,68,68,0.18)"
                        : "rgba(255,255,255,0.06)",
                  color:
                    customerOrders[0].status === "ACCEPTED"
                      ? "#22c55e"
                      : customerOrders[0].status === "REJECTED"
                        ? "#ef4444"
                        : "rgba(255,255,255,0.85)",
                }}
              >
                {customerOrders[0].status === "ACCEPTED"
                  ? "Accepted"
                  : customerOrders[0].status === "REJECTED"
                    ? "Rejected"
                    : "Pending"}
              </div>
            </div>

            <div className="mt-2 text-xs opacity-80 flex items-center gap-2">
              <Clock size={14} />
              <span>Waiting for kitchen response</span>
              {customerOrders[0].status === "ACCEPTED" ? (
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck size={14} />
                  <span>Proceed to billing counter when called</span>
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {customerOrders[0].items.map((i) => (
                <div key={i.productId} className="flex items-center justify-between text-sm">
                  <div className="font-extrabold">
                    {i.quantity}× <span className="font-extrabold">{i.name}</span>
                  </div>
                  <div className="font-extrabold">₹{i.subtotal}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="font-extrabold opacity-90">Total</div>
              <div className="font-extrabold">₹{customerOrders[0].total}</div>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      <div className="px-4 pt-5 pb-2">
        <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((c) => {
            const active = c.id === activeCategoryId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategoryId(c.id)}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-extrabold border transition-colors"
                style={{
                  background: active ? "rgba(230,57,70,0.95)" : "rgba(255,255,255,0.03)",
                  borderColor: active ? "rgba(230,57,70,0.95)" : "rgba(255,255,255,0.10)",
                  color: "#fff",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 px-4 pb-28">
        <div className="max-w-3xl mx-auto">
        {filteredProducts.length === 0 ? (
          <div className="text-sm opacity-70 py-10 text-center">No items in this category</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {filteredProducts.map((p) => {
              const q = cart[p.id]?.quantity ?? 0;
              return (
                <div
                  key={p.id}
                  className="rounded-3xl border p-3.5 flex flex-col gap-2"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  }}
                >
                  <div className="min-h-[44px] font-extrabold leading-snug tracking-wide">{p.name}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold">₹{p.price}</div>
                    {q > 0 ? (
                      <div className="text-[11px] font-extrabold px-2 py-1 rounded-full" style={{ background: "rgba(230,57,70,0.18)", color: "#fff" }}>
                        In cart • {q}
                      </div>
                    ) : null}
                  </div>
                  {p.categoryName ? <div className="text-[11px] opacity-60">{p.categoryName}</div> : null}

                  {q === 0 ? (
                    <button
                      onClick={() => add(p)}
                      className="mt-1 w-full py-3 rounded-2xl font-extrabold text-sm"
                      style={{ background: "#e63946", color: "#fff" }}
                    >
                      Add
                    </button>
                  ) : (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <button
                        onClick={() => dec(p.id)}
                        className="w-11 h-11 rounded-2xl border flex items-center justify-center"
                        style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.20)" }}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={18} />
                      </button>
                      <div className="font-extrabold text-base">{q}</div>
                      <button
                        onClick={() => inc(p.id)}
                        className="w-11 h-11 rounded-2xl border flex items-center justify-center"
                        style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.20)" }}
                        aria-label="Increase quantity"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => setDrawerOpen(true)}
          disabled={totalItems === 0}
          className="w-full rounded-3xl px-4 py-4 flex items-center justify-between border transition-opacity shadow-xl"
          style={{
            background: totalItems === 0 ? "rgba(255,255,255,0.03)" : "rgba(230,57,70,0.18)",
            borderColor: totalItems === 0 ? "rgba(255,255,255,0.10)" : "rgba(230,57,70,0.55)",
            color: "#fff",
            opacity: totalItems === 0 ? 0.6 : 1,
          }}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} />
            <span className="font-extrabold text-sm">{totalItems} items</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-extrabold">₹{totalAmount}</span>
            <span className="font-extrabold text-sm">Order →</span>
          </div>
        </button>
        {error ? <div className="mt-2 text-xs" style={{ color: "#e63946" }}>{error}</div> : null}
      </div>

      <div
        className={`fixed inset-0 z-50 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className={`fixed left-0 right-0 bottom-0 z-50 transition-transform duration-200 ${drawerOpen ? "translate-y-0" : "translate-y-full"}`}
        style={{ background: "#0b0b0b", borderTop: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="px-4 py-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-extrabold text-base">Your Cart</div>
            <button onClick={() => setDrawerOpen(false)} className="text-sm font-semibold opacity-80">
              Close
            </button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-3">
            {cartLines.length === 0 ? (
              <div className="text-sm opacity-70 py-6 text-center">Cart is empty</div>
            ) : (
              cartLines.map((l) => (
                <div
                  key={l.product.id}
                  className="rounded-3xl border p-3.5"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold leading-snug tracking-wide">{l.product.name}</div>
                      <div className="text-xs opacity-70">₹{l.product.price} each</div>
                    </div>
                    <button
                      onClick={() => remove(l.product.id)}
                      className="w-10 h-10 rounded-2xl border flex items-center justify-center"
                      style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.20)" }}
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => dec(l.product.id)}
                        className="w-11 h-11 rounded-2xl border flex items-center justify-center"
                        style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.20)" }}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={18} />
                      </button>
                      <div className="font-extrabold text-base w-10 text-center">{l.quantity}</div>
                      <button
                        onClick={() => inc(l.product.id)}
                        className="w-11 h-11 rounded-2xl border flex items-center justify-center"
                        style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.20)" }}
                        aria-label="Increase quantity"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="font-extrabold">₹{l.product.price * l.quantity}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold opacity-70">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder="Any special instructions?"
              className="mt-2 w-full rounded-3xl p-3 text-sm outline-none border"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.10)",
                color: "#fff",
              }}
              rows={3}
            />
            <div className="mt-1 text-[11px] opacity-60">{notes.length}/200</div>
          </div>

          <button
            onClick={placeOrder}
            disabled={cartLines.length === 0 || placing}
            className="mt-4 w-full py-4 rounded-3xl font-extrabold text-base transition-opacity shadow-xl"
            style={{
              background: "#e63946",
              color: "#fff",
              opacity: cartLines.length === 0 || placing ? 0.6 : 1,
            }}
          >
            {placing ? "Placing…" : `Place Order • ₹${totalAmount}`}
          </button>
        </div>
      </div>
    </div>
  );
}

