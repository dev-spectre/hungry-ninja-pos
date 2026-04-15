"use client";

import { usePathname } from "next/navigation";
import { Sun, Moon, LayoutDashboardIcon, LogOut } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import Link from "next/link";
import { useState, useEffect } from "react";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/": "New Bill",
  "/history": "Sales History",
  "/super-admin": "System Administration",
  "/admin": "Product Admin",
  "/admin/tables": "Tables",
  "/expenses": "Expenses",
  "/inventory": "Inventory",
  "/kitchen": "Kitchen Display",
  "/closing": "Closing Report",
  "/backup": "Backup & Restore",
};

export default function TopBar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "PoS";
  const { isDark, toggle } = useTheme();
  
  const [role, setRole] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem('user_role'));
    setBranchName(localStorage.getItem('active_branch_name'));
    setMounted(true);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("user_role");
    ['tst_cache_products', 'tst_cache_categories', 'tst_cache_transactions', 'tst_cache_expenses', 'tst_cache_inventory'].forEach(k => localStorage.removeItem(k));
    window.location.href = "/login";
  };

  if (!mounted || pathname === "/login" || pathname.startsWith("/order/")) return null;

  return (
    <header
      className="flex items-center px-4 shrink-0"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        height: "52px",
      }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
          HN
        </div>
        <div className="flex flex-col justify-center">
          <span className="font-semibold text-sm leading-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
          {branchName && (
             <span className="text-[11px] font-bold tracking-wide uppercase mt-0.5" style={{ color: "var(--accent)" }}>
               {branchName}
             </span>
          )}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {role?.includes("SUPER_ADMIN") && (
           <Link href="/super-admin" className="text-sm flex gap-1 flex-col items-center justify-between font-medium text-(--text-muted) hover:text-(--accent)">
             <LayoutDashboardIcon size={16} />
           </Link>
        )}
        {role?.includes("SHOP_MANAGER") && (
          <Link href="/dashboard" className="text-sm flex gap-1 flex-col items-center justify-between font-medium text-(--text-muted) hover:text-(--accent)">
            <LayoutDashboardIcon size={16} />
          </Link>
        )}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{
            background: "var(--red-soft)",
            color: "var(--red)",
          }}>
          <LogOut size={16} />
        </button>
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
