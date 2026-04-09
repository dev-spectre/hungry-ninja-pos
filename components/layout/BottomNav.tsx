"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Settings,
  Receipt,
  Package,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Billing", icon: ShoppingCart },
  { href: "/history", label: "History", icon: History },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/admin", label: "Admin", icon: Settings },
];

const superAdminNavItems = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/inventory", label: "Global Inventory", icon: Package }
];

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem('user_role'));
    setActiveBranch(localStorage.getItem('active_branch_id'));
    setMounted(true);
  }, [pathname]);

  if (!mounted || pathname === '/login') return null;

  const filteredNavItems = (role === "SUPER_ADMIN" && !activeBranch) 
    ? superAdminNavItems 
    : navItems.filter((item) => {
        if (role === "SUPER_ADMIN" && activeBranch) return true;
        if (role === "SHOP_MANAGER") return true; 
        if (role === "BILLING") return ["/", "/history"].includes(item.href);
        if (role === "INVENTORY") return ["/inventory", "/history"].includes(item.href);
        
        // If KITCHEN or other, fallback to billing/history. 
        // If not hydrated yet, return empty to prevent flashing unwanted tabs.
        if (!role) return false;
        return ["/", "/history"].includes(item.href);
      });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        height: "64px",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {filteredNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200"
            style={{
              color: active ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                width: "44px",
                height: "28px",
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
            </div>
            <span
              className="font-medium"
              style={{ fontSize: "9px", letterSpacing: "0.02em" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
