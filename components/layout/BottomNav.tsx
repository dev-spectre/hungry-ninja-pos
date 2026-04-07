"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Settings,
  Receipt,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Billing", icon: ShoppingCart },
  { href: "/history", label: "History", icon: History },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin", label: "Admin", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

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
      {navItems.map(({ href, label, icon: Icon }) => {
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
