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
  ChefHat,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Billing", icon: ShoppingCart },
  { href: "/history", label: "History", icon: History },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/admin", label: "Admin", icon: Settings },
];

const superAdminNavItems = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/inventory", label: "Global Inventory", icon: Package }
];

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any>({});
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tableOrdersCount, setTableOrdersCount] = useState<number>(0);

  useEffect(() => {
    setRole(localStorage.getItem('user_role'));
    try {
        setPermissions(JSON.parse(localStorage.getItem('user_permissions') || "{}"));
    } catch {
        setPermissions({});
    }
    setActiveBranch(localStorage.getItem('active_branch_id'));
    setMounted(true);
  }, [pathname]);

  useEffect(() => {
    if (!mounted || pathname === "/login" || pathname.startsWith("/order/")) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/kitchen/orders?status=ACCEPTED");
        if (!res.ok) return;
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) setTableOrdersCount(data.length);
      } catch {
        // ignore
      }
    };

    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mounted, pathname]);

  if (!mounted || pathname === "/login" || pathname.startsWith("/order/")) return null;

  const filteredNavItems = (role?.includes("SUPER_ADMIN") && !activeBranch) 
    ? superAdminNavItems 
    : navItems.filter((item) => {
        if (role?.includes("SUPER_ADMIN") && activeBranch) return true;
        if (role?.includes("SHOP_MANAGER")) return true; 

        if (item.label === "Kitchen") return role?.includes("KITCHEN") || role?.includes("SHOP_MANAGER") || role?.includes("SUPER_ADMIN");

        if (Object.keys(permissions).length > 0) {
            if (item.label === 'Billing') return permissions.billing?.read;
            if (item.label === 'History') return permissions.history?.read;
            if (item.label === 'Expenses') return permissions.expenses?.read;
            if (item.label === 'Inventory') return permissions.inventory?.read;
            if (item.label === 'Kitchen') return permissions.kitchen?.read;
            if (item.label === 'Admin') return permissions.admin?.read;
            return false;
        }

        if (role?.includes("BILLING") && !role.includes("INVENTORY")) return ["/", "/history"].includes(item.href);
        if (role?.includes("INVENTORY") && !role.includes("BILLING")) return ["/inventory", "/history"].includes(item.href);
        if (role?.includes("INVENTORY") && role.includes("BILLING")) return true;
        return false;
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
              <div className="relative">
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {label === "Billing" && tableOrdersCount > 0 ? (
                  <span
                    className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center"
                    style={{ background: "var(--red)", color: "#fff" }}
                  >
                    {tableOrdersCount > 99 ? "99+" : tableOrdersCount}
                  </span>
                ) : null}
              </div>
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
