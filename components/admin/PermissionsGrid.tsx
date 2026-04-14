"use client";

import { UserPermissions } from "@/types";

interface PermissionsGridProps {
  initialPermissions?: UserPermissions | null;
}

const PAGES = ['billing', 'history', 'expenses', 'inventory', 'kitchen', 'admin'] as const;

export function PermissionsGrid({ initialPermissions }: PermissionsGridProps) {
  return (
    <div className="mt-2 border border-(--border) rounded-lg p-3 bg-(--bg-card)">
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Granular Permissions
      </p>
      <div className="grid grid-cols-4 gap-2 text-[10px] text-center font-bold mb-1" style={{ color: "var(--text-muted)" }}>
        <span className="text-left">Page</span>
        <span>Read</span>
        <span>Write</span>
        <span>Delete</span>
      </div>
      <div className="space-y-1">
        {PAGES.map((page) => (
          <div key={page} className="grid grid-cols-4 gap-2 text-xs items-center py-1 border-t border-(--border)/30 first:border-0">
            <span className="capitalize" style={{ color: "var(--text-secondary)" }}>
              {page}
            </span>
            <input
              type="checkbox"
              name={`perm_${page}_read`}
              defaultChecked={initialPermissions?.[page]?.read ?? false}
              className="mx-auto w-4 h-4 rounded border-(--border)"
            />
            <input
              type="checkbox"
              name={`perm_${page}_write`}
              defaultChecked={initialPermissions?.[page]?.write ?? false}
              className="mx-auto w-4 h-4 rounded border-(--border)"
            />
            <input
              type="checkbox"
              name={`perm_${page}_delete`}
              defaultChecked={initialPermissions?.[page]?.delete ?? false}
              className="mx-auto w-4 h-4 rounded border-(--border)"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
