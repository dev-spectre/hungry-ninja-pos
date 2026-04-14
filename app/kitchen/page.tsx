"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Circle, RotateCw, Check, X as XIcon } from "lucide-react";

type CustomerOrderStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "BILLED";

type KitchenOrderItem = {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;
};

type KitchenTable = { id: string; name: string };

type KitchenOrder = {
  id: string;
  branchId: string;
  tableId: string;
  status: CustomerOrderStatus;
  items: KitchenOrderItem[];
  totalAmount: number;
  notes?: string | null;
  transactionId?: string | null;
  createdAt: string;
  updatedAt: string;
  table: KitchenTable;
};

type WsMsg =
  | { type: "NEW_ORDER"; order: KitchenOrder }
  | { type: "ORDER_UPDATED"; orderId: string; status: CustomerOrderStatus };

function timeAgo(ts: string) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hr ago";
  return `${hrs} hrs ago`;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/orders", { method: "GET" });
      if (!res.ok) throw new Error(res.status === 401 ? "Unauthorized" : "Failed to load orders");
      const data = (await res.json()) as KitchenOrder[];
      setOrders(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const branchIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const getBranchIdForWs = useCallback(async () => {
    if (!branchIdPromiseRef.current) {
      branchIdPromiseRef.current = fetch("/api/auth/me")
        .then(async (r) => {
          if (!r.ok) return null;
          const j = (await r.json()) as any;
          const session = j?.user;
          const role = typeof session?.role === "string" ? session.role : "";
          const sessionBranchId = typeof session?.branchId === "string" ? session.branchId : null;
          const activeBranch = localStorage.getItem("active_branch_id");
          if (role.includes("SUPER_ADMIN") && !sessionBranchId) return activeBranch || null;
          return sessionBranchId || activeBranch || null;
        })
        .catch(() => null);
    }
    return await branchIdPromiseRef.current;
  }, []);

  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

    // ── No WS URL configured → go straight to polling ──
    if (!wsUrl) {
      setPolling(true);
      return;
    }

    let alive = true;
    let ws: WebSocket | null = null;
    let retry = 0;
    const MAX_RETRIES = 5;
    let retryTimer: any = null;

    const connect = async () => {
      const branchId = await getBranchIdForWs();
      if (!alive || !branchId) return;

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        // WebSocket constructor can throw on invalid URLs
        if (!alive) return;
        setPolling(true);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) return;
        retry = 0;
        setConnected(true);
        setPolling(false);
        ws?.send(JSON.stringify({ type: "JOIN", branchId }));
      };

      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        if (retry >= MAX_RETRIES) {
          // Give up on WS, switch to polling
          setPolling(true);
          return;
        }
        const delay = Math.min(10_000, 800 * Math.pow(1.6, retry++));
        retryTimer = setTimeout(() => connect(), delay);
      };

      ws.onerror = () => {
        if (!alive) return;
        setConnected(false);
        try {
          ws?.close();
        } catch {
          // ignore
        }
      };

      ws.onmessage = (ev) => {
        const raw = typeof ev.data === "string" ? ev.data : "";
        try {
          const msg = JSON.parse(raw) as WsMsg;
          if (msg.type === "NEW_ORDER") {
            setOrders((prev) => [msg.order, ...prev]);
          } else if (msg.type === "ORDER_UPDATED") {
            setOrders((prev) =>
              prev.map((o) => (o.id === msg.orderId ? { ...o, status: msg.status } : o)),
            );
          }
        } catch {
          // ignore
        }
      };
    };

    connect();

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [getBranchIdForWs]);

  // ── HTTP polling fallback (when WS is unavailable) ──
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      fetch("/api/kitchen/orders", { method: "GET" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data)) setOrders(data);
        })
        .catch(() => {});
    }, 8_000);
    return () => clearInterval(interval);
  }, [polling]);

  const handleAction = useCallback(async (id: string, action: "ACCEPT" | "REJECT") => {
    setError(null);
    try {
      const res = await fetch(`/api/kitchen/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Failed");
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED" } : o)),
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  }, []);

  const dismissRejected = useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const pendingOrAccepted = useMemo(() => {
    return orders.filter((o) => o.status === "PENDING" || o.status === "ACCEPTED" || o.status === "REJECTED");
  }, [orders]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center justify-between">
          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
            <span className="inline-flex items-center gap-2">
              <ChefHat size={16} />
              Kitchen Display
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <Circle size={10} fill={connected ? "var(--green)" : polling ? "var(--accent)" : "var(--red)"} color={connected ? "var(--green)" : polling ? "var(--accent)" : "var(--red)"} />
              {connected ? "Live" : polling ? "Polling" : "Disconnected"}
            </div>
            <button
              onClick={refresh}
              className="text-xs font-semibold px-3 py-2 rounded-xl"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <span className="inline-flex items-center gap-2">
                <RotateCw size={14} />
                Refresh
              </span>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-3 text-sm" style={{ color: "var(--red)" }}>
          {error}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading orders…
          </div>
        ) : pendingOrAccepted.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            No orders yet today.
          </div>
        ) : (
          pendingOrAccepted.map((o) => {
            return (
              <div
                key={o.id}
                className="rounded-2xl p-4"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>
                      {o.table?.name ?? "Table"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {timeAgo(o.createdAt)}
                    </div>
                  </div>
                  <div
                    className="text-xs font-extrabold px-3 py-1 rounded-full"
                    style={{
                      background:
                        o.status === "ACCEPTED"
                          ? "var(--green-soft)"
                          : o.status === "REJECTED"
                            ? "var(--red-soft)"
                            : "rgba(255,255,255,0.06)",
                      color:
                        o.status === "ACCEPTED" ? "var(--green)" : o.status === "REJECTED" ? "var(--red)" : "var(--text-muted)",
                    }}
                  >
                    {o.status === "ACCEPTED" ? "Sent to Billing" : o.status === "REJECTED" ? "Rejected" : "Pending"}
                  </div>
                </div>

                <div className="mt-3 border-t pt-3 space-y-2" style={{ borderColor: "var(--border)" }}>
                  {o.items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-sm">
                      <div style={{ color: "var(--text-primary)" }}>
                        <span className="font-extrabold">{i.quantity}×</span> {i.productName}
                      </div>
                      <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>
                        ₹{i.subtotal}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
                    Total: ₹{o.totalAmount}
                  </div>
                  {o.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(o.id, "ACCEPT")}
                        className="px-4 py-2 rounded-xl font-extrabold text-sm"
                        style={{ background: "var(--green)", color: "#fff" }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Check size={16} />
                          ACCEPT
                        </span>
                      </button>
                      <button
                        onClick={() => handleAction(o.id, "REJECT")}
                        className="px-4 py-2 rounded-xl font-extrabold text-sm"
                        style={{ background: "var(--red)", color: "#fff" }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <XIcon size={16} />
                          REJECT
                        </span>
                      </button>
                    </div>
                  ) : o.status === "REJECTED" ? (
                    <button
                      onClick={() => dismissRejected(o.id)}
                      className="px-4 py-2 rounded-xl font-extrabold text-sm"
                      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    >
                      × Dismiss
                    </button>
                  ) : null}
                </div>

                {o.notes ? (
                  <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    Notes: {o.notes}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

