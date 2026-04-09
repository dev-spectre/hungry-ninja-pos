"use client";

import { useEffect, useState } from "react";
import { PagePermissions, UserPermissions } from "@/types";

export function usePermissions(pageKey: keyof UserPermissions) {
  const [perms, setPerms] = useState<PagePermissions>({ read: true, write: true, delete: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const storedPermissions = localStorage.getItem('user_permissions');

    if (storedPermissions) {
      try {
        const parsed = JSON.parse(storedPermissions);
        if (parsed[pageKey]) {
          setPerms(parsed[pageKey]);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("RBAC parse error", e);
      }
    }

    // Fallback: Admins get full access if no specific matrix entry is found
    if (role?.includes("SUPER_ADMIN") || role?.includes("SHOP_MANAGER")) {
        setPerms({ read: true, write: true, delete: true });
    } else {
        setPerms({ read: false, write: false, delete: false });
    }
    setLoading(false);
  }, [pageKey]);

  return { ...perms, loading };
}
