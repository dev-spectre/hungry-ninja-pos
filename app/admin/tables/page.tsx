"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Download, Plus, RefreshCcw, ToggleLeft, ToggleRight, X } from "lucide-react";

type TableModel = {
  id: string;
  name: string;
  branchId: string;
  qrToken: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [bulkCount, setBulkCount] = useState("10");
  const [bulkPrefix, setBulkPrefix] = useState("Table ");
  const [bulkStart, setBulkStart] = useState("1");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkQrOpen, setBulkQrOpen] = useState(false);
  const [bulkQrItems, setBulkQrItems] = useState<Array<{ name: string; url: string }>>([]);
  const [bulkQrRendered, setBulkQrRendered] = useState<Array<{ name: string; url: string; dataUrl: string }>>([]);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrTable, setQrTable] = useState<TableModel | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const appUrl = useMemo(
    () => process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tables");
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || "Failed to load tables");
      setTables(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openQr = useCallback(
    (t: TableModel) => {
      setQrTable(t);
      setQrOpen(true);
      setError(null);
    },
    [],
  );

  // Render QR to canvas AFTER the modal is in the DOM
  useEffect(() => {
    if (!qrOpen || !qrTable || !canvasRef.current) return;
    const url = `${appUrl.replace(/\/+$/, "")}/order/${qrTable.qrToken}`;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 280,
      margin: 2,
      color: { dark: "#ffffff", light: "#0f0f0f" },
    }).catch(() => setError("Failed to render QR"));
  }, [qrOpen, qrTable, appUrl]);

  const downloadQr = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qrTable) return;
    const a = document.createElement("a");
    a.download = `${qrTable.name.replace(/\\s+/g, "_")}_QR.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [qrTable]);

  const createTable = useCallback(async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to create table");
      setAddOpen(false);
      setNewName("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create table");
    } finally {
      setSaving(false);
    }
  }, [newName, saving, refresh]);

  const createBulk = useCallback(async () => {
    if (bulkWorking) return;
    const count = Number(bulkCount);
    const start = Number(bulkStart);
    if (!Number.isFinite(count) || count <= 0 || count > 200) {
      setError("Enter a valid count (1–200)");
      return;
    }
    if (!Number.isFinite(start) || start <= 0 || start > 100000) {
      setError("Enter a valid start number");
      return;
    }

    setBulkWorking(true);
    setError(null);
    try {
      const created: TableModel[] = [];
      for (let i = 0; i < count; i++) {
        const name = `${bulkPrefix}${start + i}`.trim();
        const res = await fetch("/api/admin/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `Failed creating ${name}`);
        }
        created.push(data as TableModel);
      }

      await refresh();

      const items = created.map((t) => ({
        name: t.name,
        url: `${appUrl.replace(/\/+$/, "")}/order/${t.qrToken}`,
      }));
      setBulkQrItems(items);
      setBulkQrRendered([]);
      setBulkQrOpen(true);
    } catch (e: any) {
      setError(e?.message ?? "Bulk create failed");
    } finally {
      setBulkWorking(false);
    }
  }, [bulkWorking, bulkCount, bulkStart, bulkPrefix, refresh, appUrl]);

  const printBulk = useCallback(() => {
    const html = document.getElementById("bulk-print-root")?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>Print QRs</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 12px; break-inside: avoid; }
            .name { font-weight: 800; margin-bottom: 8px; }
            img { width: 100%; height: auto; }
            @media print { body { padding: 0; } .card { border: 1px solid #ccc; } }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }, []);

  useEffect(() => {
    if (!bulkQrOpen) return;
    let cancelled = false;
    (async () => {
      const imgs = await Promise.all(
        bulkQrItems.map(async (i) => ({
          ...i,
          dataUrl: await QRCode.toDataURL(i.url, {
            width: 280,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          }),
        })),
      );
      if (!cancelled) {
        setBulkQrRendered(imgs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bulkQrOpen, bulkQrItems]);

  const toggleActive = useCallback(
    async (t: TableModel) => {
      setError(null);
      const res = await fetch(`/api/admin/tables/${encodeURIComponent(t.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to update table");
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const regenerate = useCallback(
    async (t: TableModel) => {
      const ok = window.confirm("Regenerate QR token? Old printed QR codes will stop working.");
      if (!ok) return;
      setError(null);
      const res = await fetch(`/api/admin/tables/${encodeURIComponent(t.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to regenerate");
        return;
      }
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-extrabold text-lg" style={{ color: "var(--text-primary)" }}>
            Tables
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Manage QR tables for this branch
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl text-sm font-extrabold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            Back
          </Link>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <Plus size={16} />
            Add Table
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm" style={{ color: "var(--red)" }}>
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
            Table List
          </div>
          <button
            onClick={refresh}
            className="px-3 py-2 rounded-xl text-xs font-extrabold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            Refresh
          </button>
        </div>

        {/* Bulk QR tools */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-sm font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
            Bulk generate & print
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              className="px-3 py-2 rounded-xl outline-none text-sm"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              placeholder='Prefix (e.g. "Table ")'
            />
            <input
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
              className="px-3 py-2 rounded-xl outline-none text-sm"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              placeholder="Start #"
              inputMode="numeric"
            />
            <input
              value={bulkCount}
              onChange={(e) => setBulkCount(e.target.value)}
              className="px-3 py-2 rounded-xl outline-none text-sm"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              placeholder="Count"
              inputMode="numeric"
            />
          </div>
          <button
            onClick={createBulk}
            disabled={bulkWorking}
            className="mt-3 w-full py-3 rounded-2xl font-extrabold text-sm"
            style={{ background: "var(--accent)", color: "#fff", opacity: bulkWorking ? 0.7 : 1 }}
          >
            {bulkWorking ? "Generating…" : "Generate tables + open QR sheet"}
          </button>
          <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Creates tables as: <span className="font-semibold">{bulkPrefix}{bulkStart}…</span> (max 200 at once)
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {loading ? (
            <div className="px-4 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
              Loading…
            </div>
          ) : tables.length === 0 ? (
            <div className="px-4 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
              No tables yet.
            </div>
          ) : (
            tables.map((t) => (
              <div key={t.id} className="px-4 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>
                    {t.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t.isActive ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openQr(t)}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <Download size={14} />
                    Download QR
                  </button>
                  <button
                    onClick={() => regenerate(t)}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <RefreshCcw size={14} />
                    Regenerate
                  </button>
                  <button
                    onClick={() => toggleActive(t)}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: t.isActive ? "var(--green)" : "var(--text-muted)" }}
                    aria-label="Toggle active"
                  >
                    {t.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl shadow-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
              <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>
                Add Table
              </div>
              <button
                onClick={() => setAddOpen(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='e.g. "Table 1"'
                className="w-full px-4 py-3 rounded-2xl outline-none"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={createTable}
                disabled={!newName.trim() || saving}
                className="w-full py-3 rounded-2xl font-extrabold"
                style={{ background: "var(--accent)", color: "#fff", opacity: !newName.trim() || saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrOpen && qrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl shadow-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {qrTable.name} QR
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Encodes: {`${appUrl.replace(/\/+$/, "")}/order/${qrTable.qrToken}`}
                </div>
              </div>
              <button
                onClick={() => setQrOpen(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col items-center gap-4">
              <div className="rounded-2xl p-3" style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.10)" }}>
                <canvas ref={canvasRef} />
              </div>
              <button
                onClick={downloadQr}
                className="w-full py-3 rounded-2xl font-extrabold flex items-center justify-center gap-2"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <Download size={16} />
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk print modal */}
      {bulkQrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl shadow-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <div className="font-extrabold" style={{ color: "var(--text-primary)" }}>
                  Bulk QR sheet
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Download individual PNGs from the list, or Print to print the full sheet.
                </div>
              </div>
              <button
                onClick={() => setBulkQrOpen(false)}
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 flex gap-2">
              <button
                onClick={printBulk}
                className="px-4 py-2 rounded-2xl font-extrabold text-sm"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Print
              </button>
              <button
                onClick={() => setBulkQrOpen(false)}
                className="px-4 py-2 rounded-2xl font-extrabold text-sm"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                Close
              </button>
            </div>

            <div className="px-5 pb-5 max-h-[70vh] overflow-y-auto">
              <div id="bulk-print-root">
                <div className="grid grid-cols-2 gap-3">
                  {(bulkQrItems as any[]).map((i) => (
                    <div key={i.url} className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                      <div className="font-extrabold text-sm mb-2" style={{ color: "var(--text-primary)" }}>
                        {i.name}
                      </div>
                      {bulkQrRendered.find((r) => r.url === i.url)?.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bulkQrRendered.find((r) => r.url === i.url)!.dataUrl}
                          alt={`${i.name} QR`}
                          className="w-full rounded-xl bg-white"
                        />
                      ) : (
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Rendering…
                        </div>
                      )}
                      <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {i.url}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

