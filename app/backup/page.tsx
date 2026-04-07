"use client";

import { useRef, useState, useCallback } from "react";
import { getItem, setItem, KEYS } from "@/lib/storage";
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Database,
} from "lucide-react";

const ALL_KEYS = [
  KEYS.OPENING_CASH,
  KEYS.DARK_MODE,
  KEYS.ADMIN_PIN,
  KEYS.SLOW_MOVING_THRESHOLD,
  KEYS.UPI_ID,
] as const;

interface BackupFile {
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

function isValidBackup(obj: unknown): obj is BackupFile {
  if (typeof obj !== "object" || obj === null) return false;
  const b = obj as Record<string, unknown>;
  return (
    typeof b.version === "number" &&
    typeof b.exportedAt === "string" &&
    typeof b.data === "object" &&
    b.data !== null
  );
}

export default function BackupPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [restoreState, setRestoreState] = useState<"idle" | "confirm" | "success" | "error">("idle");
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Export ─────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const data: Record<string, unknown> = {};
    for (const key of ALL_KEYS) {
      const val = getItem<unknown>(key);
      if (val !== null) data[key] = val;
    }
    const backup: BackupFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tst-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Import — File selected ─────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith(".json")) {
        setErrorMsg("Please upload a .json backup file.");
        setRestoreState("error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (!isValidBackup(parsed)) {
            setErrorMsg("Invalid backup file format. Please use a file exported from this app.");
            setRestoreState("error");
            return;
          }
          setPendingBackup(parsed);
          setRestoreState("confirm");
        } catch {
          setErrorMsg("Failed to parse the file. Make sure it is a valid JSON backup.");
          setRestoreState("error");
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    []
  );

  // ── Import — Confirmed ─────────────────────────────────────────
  const handleRestoreConfirm = useCallback(() => {
    if (!pendingBackup) return;
    try {
      for (const [key, value] of Object.entries(pendingBackup.data)) {
        setItem(key, value);
      }
      setPendingBackup(null);
      setRestoreState("success");
      // Small delay then reload to reflect restored state
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setErrorMsg("An error occurred while restoring data.");
      setRestoreState("error");
    }
  }, [pendingBackup]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
      >
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Database size={22} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-base leading-tight">Backup & Restore</p>
          <p className="text-white/70 text-xs">Export or restore all app data</p>
        </div>
      </div>

      {/* Export Card */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Download size={16} style={{ color: "var(--green)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Export Backup
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Downloads a single JSON file containing all products, categories, transactions, expenses, archived reports and settings.
        </p>
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--green)", color: "#fff" }}
        >
          <Download size={15} /> Download Backup JSON
        </button>
      </div>

      {/* Restore Card */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Upload size={16} style={{ color: "var(--blue)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Restore Backup
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Upload a previously exported backup JSON file. This will overwrite existing data — make sure to export a fresh backup first.
        </p>

        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => { setRestoreState("idle"); fileInput.current?.click(); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--blue-soft)", color: "var(--blue)", border: "1px solid var(--blue)" }}
        >
          <Upload size={15} /> Choose Backup File
        </button>
      </div>

      {/* Confirm dialog */}
      {restoreState === "confirm" && pendingBackup && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: "var(--yellow-soft)", border: "1px solid var(--yellow)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "var(--yellow)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Confirm Restore
            </p>
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Backup exported on:{" "}
            <strong>{new Date(pendingBackup.exportedAt).toLocaleString("en-IN")}</strong>
            <br />
            This will overwrite all current data and reload the app.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRestoreConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--yellow)", color: "#0f172a" }}
            >
              Yes, Restore
            </button>
            <button
              onClick={() => { setRestoreState("idle"); setPendingBackup(null); }}
              className="flex-1 py-2.5 rounded-xl text-sm"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {restoreState === "success" && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: "var(--green-soft)", border: "1px solid var(--green)" }}
        >
          <CheckCircle size={18} style={{ color: "var(--green)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Data restored successfully. Reloading…
          </p>
        </div>
      )}

      {/* Error */}
      {restoreState === "error" && (
        <div
          className="p-4 rounded-2xl space-y-2"
          style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "var(--red)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Restore Failed
            </p>
          </div>
          <p className="text-xs" style={{ color: "var(--red)" }}>{errorMsg}</p>
          <button
            onClick={() => setRestoreState("idle")}
            className="text-xs underline"
            style={{ color: "var(--text-muted)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Safety note */}
      <div
        className="flex items-start gap-3 p-3 rounded-2xl"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
      >
        <ShieldCheck size={16} style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0" />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          All data is stored locally on your device. Regular exports are recommended to prevent data loss when clearing browser/app storage.
        </p>
      </div>
    </div>
  );
}
