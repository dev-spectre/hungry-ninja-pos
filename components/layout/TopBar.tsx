"use client";

import { usePathname } from "next/navigation";
import { Sun, Moon, LayoutDashboardIcon } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import Link from "next/link";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/": "New Bill",
  "/history": "Sales History",
  "/admin": "Product Admin",
  "/expenses": "Expenses",
  "/inventory": "Inventory",
  "/closing": "Closing Report",
  "/backup": "Backup & Restore",
};

export default function TopBar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Today Sales Tracker";
  const { isDark, toggle } = useTheme();

  return (
    <header
      className="flex items-center px-4 shrink-0"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        height: "52px",
      }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
          T
        </div>
        <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <Link href="/dashboard" className="text-sm flex gap-1 flex-col items-center justify-between font-medium text-(--text-muted) hover:text-(--accent)">
          <LayoutDashboardIcon size={16} />
        </Link>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggle}
          aria-label="Toggle dark mode"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
