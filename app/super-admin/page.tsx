"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash, LogOut, Building, User, Pencil, Play, Check, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PermissionsGrid } from "@/components/admin/PermissionsGrid";
import { clearBranchCache } from "@/lib/storage";
import toast from "react-hot-toast";

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"branches" | "users">("branches");
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const router = useRouter();

  // Pending states
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [pendingBranchOps, setPendingBranchOps] = useState<Set<string>>(new Set());
  const [pendingUserOps, setPendingUserOps] = useState<Set<string>>(new Set());

  // Refs for form reset
  const branchFormRef = useRef<HTMLFormElement>(null);
  const userFormRef = useRef<HTMLFormElement>(null);

  // Original admin ID (first SUPER_ADMIN by createdAt)
  const [originalAdminId, setOriginalAdminId] = useState<string | null>(null);

  useEffect(() => {
    document.cookie = 'active_branch_id=; Max-Age=0; path=/;';
    localStorage.removeItem('active_branch_id');
    fetchBranches();
    fetchUsers();
  }, []);

  // Identify original admin whenever users change
  useEffect(() => {
    const superAdmins = users
      .filter(u => u.role?.includes('SUPER_ADMIN'))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setOriginalAdminId(superAdmins[0]?.id ?? null);
  }, [users]);

  const fetchBranches = async () => {
    const res = await fetch("/api/branch", { headers: { "x-requested-branch": "GLOBAL" } });
    if (res.ok) setBranches(await res.json());
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/users", { headers: { "x-requested-branch": "GLOBAL" } });
    if (res.ok) setUsers(await res.json());
  };

  const addPendingBranch = (id: string) => setPendingBranchOps(prev => new Set(prev).add(id));
  const removePendingBranch = (id: string) => setPendingBranchOps(prev => { const s = new Set(prev); s.delete(id); return s; });
  const addPendingUser = (id: string) => setPendingUserOps(prev => new Set(prev).add(id));
  const removePendingUser = (id: string) => setPendingUserOps(prev => { const s = new Set(prev); s.delete(id); return s; });

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingBranch) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;

    // Optimistic: add temp branch immediately
    const tempId = `temp_${Date.now()}`;
    const tempBranch = { id: tempId, name, address, _pending: true };
    setBranches(prev => [...prev, tempBranch]);
    branchFormRef.current?.reset();
    setCreatingBranch(true);

    try {
      const res = await fetch("/api/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address }),
      });
      if (res.ok) {
        await fetchBranches();
        toast.success("Branch created successfully");
      } else {
        // Rollback on failure
        setBranches(prev => prev.filter(b => b.id !== tempId));
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to create branch");
      }
    } catch {
      setBranches(prev => prev.filter(b => b.id !== tempId));
      toast.error("Network error creating branch");
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const data: any = Object.fromEntries(formData.entries());

    const permissions: any = {};
    const syntheticRoles: string[] = [];
    ['billing', 'history', 'expenses', 'inventory', 'kitchen', 'admin'].forEach(page => {
       const read = formData.get(`perm_${page}_read`) === 'on';
       const write = formData.get(`perm_${page}_write`) === 'on';
       const del = formData.get(`perm_${page}_delete`) === 'on';
       permissions[page] = { read, write, delete: del };

       if (read || write || del) {
          if (page === 'billing' || page === 'history' || page === 'expenses') syntheticRoles.push('BILLING');
          if (page === 'inventory') syntheticRoles.push('INVENTORY');
          if (page === 'kitchen') syntheticRoles.push('KITCHEN');
          if (page === 'admin') {
              if (data.isGlobalAdmin === "on") syntheticRoles.push('SUPER_ADMIN');
              else syntheticRoles.push('SHOP_MANAGER');
          }
       }
    });

    data.role = Array.from(new Set(syntheticRoles)).join(",");
    data.permissions = permissions;

    // Optimistic: add temp user
    const tempId = `temp_${Date.now()}`;
    const tempUser = {
      id: tempId,
      name: data.name,
      username: data.username,
      role: data.role || "BILLING",
      branchId: data.branchId || null,
      branch: branches.find(b => b.id === data.branchId) || null,
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    setUsers(prev => [...prev, tempUser]);
    userFormRef.current?.reset();
    setCreatingUser(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        // Refetch to get full user with branch relation
        await fetchUsers();
        toast.success("User created successfully");
      } else {
        setUsers(prev => prev.filter(u => u.id !== tempId));
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to create user");
      }
    } catch {
      setUsers(prev => prev.filter(u => u.id !== tempId));
      toast.error("Network error creating user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (pendingUserOps.has(id)) return;
    addPendingUser(id);

    const formData = new FormData(e.target as HTMLFormElement);
    const data: any = Object.fromEntries(formData.entries());
    data.id = id;

    const permissions: any = {};
    const syntheticRoles: string[] = [];
    ['billing', 'history', 'expenses', 'inventory', 'kitchen', 'admin'].forEach(page => {
       const read = formData.get(`perm_${page}_read`) === 'on';
       const write = formData.get(`perm_${page}_write`) === 'on';
       const del = formData.get(`perm_${page}_delete`) === 'on';
       permissions[page] = { read, write, delete: del };

       if (read || write || del) {
          if (page === 'billing' || page === 'history' || page === 'expenses') syntheticRoles.push('BILLING');
          if (page === 'inventory') syntheticRoles.push('INVENTORY');
          if (page === 'kitchen') syntheticRoles.push('KITCHEN');
          if (page === 'admin') {
              if (data.isGlobalAdmin === "on") syntheticRoles.push('SUPER_ADMIN');
              else syntheticRoles.push('SHOP_MANAGER');
          }
       }
    });

    data.role = Array.from(new Set(syntheticRoles)).join(",");
    data.permissions = permissions;

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === id ? { ...u, name: data.name, username: data.username } : u));
    setEditingUserId(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchUsers();
        toast.success("User updated successfully");
      } else {
        await fetchUsers(); // revert to real state
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to update user");
      }
    } catch {
      await fetchUsers();
      toast.error("Network error updating user");
    } finally {
      removePendingUser(id);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    if (pendingUserOps.has(id)) return;
    addPendingUser(id);

    // Optimistic removal
    const backup = users;
    setUsers(prev => prev.filter(u => u.id !== id));

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        setUsers(backup);
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to delete user");
      } else {
        toast.success("User deleted successfully");
      }
    } catch {
      setUsers(backup);
      toast.error("Network error deleting user");
    } finally {
      removePendingUser(id);
    }
  };

  const handleDeleteBranch = async (id: string, name: string) => {
    if (!confirm(`Delete branch ${name}? This will delete all products, inventory, and users tied to this branch!`)) return;
    if (pendingBranchOps.has(id)) return;
    addPendingBranch(id);

    // Optimistic removal
    const backup = branches;
    setBranches(prev => prev.filter(b => b.id !== id));

    try {
      const res = await fetch(`/api/branch?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        setBranches(backup);
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to delete branch");
      } else {
        await fetchBranches();
        toast.success("Branch deleted successfully");
      }
    } catch {
      setBranches(backup);
      toast.error("Network error deleting branch");
    } finally {
      removePendingBranch(id);
    }
  };

  const handleEditBranch = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (pendingBranchOps.has(id)) return;
    addPendingBranch(id);

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;

    // Optimistic update
    setBranches(prev => prev.map(b => b.id === id ? { ...b, name, address } : b));
    setEditingBranchId(null);

    try {
      const res = await fetch("/api/branch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, address }),
      });
      if (!res.ok) {
        await fetchBranches(); // revert
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to update branch");
      } else {
        await fetchBranches();
        toast.success("Branch updated successfully");
      }
    } catch {
      await fetchBranches();
      toast.error("Network error updating branch");
    } finally {
      removePendingBranch(id);
    }
  };

  const handleViewBranch = (id: string, name: string) => {
     clearBranchCache();
     document.cookie = `active_branch_id=${id}; path=/;`;
     localStorage.setItem('active_branch_id', id);
     localStorage.setItem('active_branch_name', name);
     window.location.href = "/";
  };

  const handleLogout = async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      
      // Clear out all cache keys and branch state securely
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_permissions');
      localStorage.removeItem('active_branch_id');
      localStorage.removeItem('active_branch_name');
      document.cookie = 'active_branch_id=; Max-Age=0; path=/;';
      
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("tst_cache_")) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      router.push('/login');
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex bg-(--bg-secondary) p-1 rounded-xl border border-(--border)">
        <button
          className="flex-1 py-2 font-medium flex justify-center items-center gap-2 rounded-lg transition-all"
          onClick={() => setActiveTab("branches")}
          style={{
            background: activeTab === "branches" ? "var(--bg-elevated)" : "transparent",
            color: activeTab === "branches" ? "var(--text-primary)" : "var(--text-muted)",
            border: activeTab === "branches" ? "1px solid var(--border)" : "1px solid transparent",
          }}
        >
          <Building size={16} /> Branches
        </button>
        <button
          className="flex-1 py-2 font-medium flex justify-center items-center gap-2 rounded-lg transition-all"
          onClick={() => setActiveTab("users")}
          style={{
            background: activeTab === "users" ? "var(--bg-elevated)" : "transparent",
            color: activeTab === "users" ? "var(--text-primary)" : "var(--text-muted)",
            border: activeTab === "users" ? "1px solid var(--border)" : "1px solid transparent",
          }}
        >
          <User size={16} /> Users & Roles
        </button>
      </div>

      {activeTab === "branches" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Add Branch</h2>
            <form ref={branchFormRef} onSubmit={handleCreateBranch} className="space-y-3 bg-(--bg-card) p-4 rounded-xl border border-(--border)">
              <input name="name" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Branch Name" required />
              <input name="address" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Address / Location" required />
              <button 
                 type="submit" 
                 disabled={creatingBranch}
                 className="w-full p-3 bg-(--accent) text-white font-semibold rounded-xl active:scale-95 transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                  {creatingBranch ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : <><Plus size={18} /> Create Branch</>}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Existing Branches</h2>
            <div className="space-y-3">
              {branches.map((b) => (
                editingBranchId === b.id ? (
                  <form onSubmit={(e) => handleEditBranch(e, b.id)} key={b.id} className="p-3 bg-(--bg-card) border border-(--border) rounded-xl flex flex-col gap-2">
                     <input name="name" defaultValue={b.name} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)" required />
                     <input name="address" defaultValue={b.address} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)" required />
                     <div className="flex gap-2">
                        <button type="submit" className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-sm flex items-center justify-center"><Check size={16}/></button>
                        <button type="button" onClick={() => setEditingBranchId(null)} className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-sm flex items-center justify-center"><X size={16}/></button>
                     </div>
                  </form>
                ) : (
                  <div key={b.id} className={`p-4 bg-(--bg-card) border border-(--border) rounded-xl flex flex-col items-start gap-3 transition-opacity ${b._pending ? 'opacity-60' : ''}`}>
                    <div className="w-full flex justify-between items-start">
                       <div>
                          <h3 className="font-bold">{b.name} {b._pending && <span className="text-xs text-(--text-muted)">(saving...)</span>}</h3>
                          <span className="text-sm text-(--text-secondary)">{b.address || "No address"}</span>
                       </div>
                       {!b._pending && (
                         <div className="flex gap-1">
                            <button onClick={() => setEditingBranchId(b.id)} disabled={pendingBranchOps.has(b.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-(--bg-elevated) hover:text-blue-500 disabled:opacity-40"><Pencil size={14}/></button>
                            <button onClick={() => handleDeleteBranch(b.id, b.name)} disabled={pendingBranchOps.has(b.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-(--bg-elevated) hover:text-red-500 disabled:opacity-40"><Trash size={14}/></button>
                         </div>
                       )}
                    </div>
                    {!b._pending && (
                      <button onClick={() => handleViewBranch(b.id, b.name)} className="w-full py-2 bg-(--accent-soft) text-(--accent) font-semibold rounded-lg text-sm flex justify-center items-center gap-2 hover:opacity-80 transition-opacity">
                          <Play size={14} /> Open Point of Sale
                      </button>
                    )}
                  </div>
                )
              ))}
              {branches.length === 0 && <p className="text-sm text-(--text-muted)">No branches created.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Add User</h2>
            <form ref={userFormRef} onSubmit={handleCreateUser} className="space-y-3 bg-(--bg-card) p-4 rounded-xl border border-(--border)">
              <input name="name" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Display Name" required />
              <input name="username" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Username" required />
              <input name="password" type="password" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Password" required />
              <label className="flex items-center gap-2 px-1 text-sm text-(--text-primary)">
                <input type="checkbox" name="isGlobalAdmin" className="w-4 h-4 rounded border-(--border)" />
                Is Global Super Admin? (Grants system-wide overrides)
              </label>

              <PermissionsGrid />

              <select name="branchId" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)">
                <option value="">Assign to Branch (Optional for Super Admin)</option>
                {branches.filter(b => !b._pending).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <button 
                 type="submit" 
                 disabled={creatingUser}
                 className="w-full p-3 bg-(--accent) text-white font-semibold rounded-xl active:scale-95 transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                  {creatingUser ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : <><Plus size={18} /> Create User</>}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">System Users</h2>
            <div className="space-y-3">
              {users.map((u) => (
                editingUserId === u.id ? (
                  <form onSubmit={(e) => handleEditUser(e, u.id)} key={u.id} className="p-3 bg-(--bg-card) border border-(--border) rounded-xl flex flex-col gap-2">
                     <input name="name" defaultValue={u.name} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)" required />
                     <input name="username" defaultValue={u.username} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)" required />
                     <input name="password" placeholder="Leave blank to keep current" type="password" className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)" />
                     <label className="flex items-center gap-2 px-1 text-sm text-(--text-primary)">
                        <input type="checkbox" name="isGlobalAdmin" defaultChecked={u.role.includes('SUPER_ADMIN')} disabled={u.id === originalAdminId} className="w-4 h-4 rounded border-(--border)" />
                        Is Global Super Admin? (Grants system-wide overrides)
                     </label>

                     <PermissionsGrid initialPermissions={u.permissions} />
                     <select name="branchId" defaultValue={u.id === originalAdminId ? "" : u.branchId || ""} disabled={u.id === originalAdminId} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)">
                        <option value="">No Branch (Global)</option>
                        {branches.filter(b => !b._pending).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                     <div className="flex gap-2 mt-1">
                        <button type="submit" disabled={pendingUserOps.has(u.id)} className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-sm flex items-center justify-center disabled:opacity-50"><Check size={16}/></button>
                        <button type="button" onClick={() => setEditingUserId(null)} className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-sm flex items-center justify-center"><X size={16}/></button>
                     </div>
                  </form>
                ) : (
                  <div key={u.id} className={`p-4 bg-(--bg-card) border border-(--border) rounded-xl flex items-center justify-between transition-opacity ${u._pending ? 'opacity-60' : ''}`}>
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm">
                        {u.name} <span className="text-(--text-secondary) font-normal">@{u.username}</span>
                        {u._pending && <span className="text-xs text-(--text-muted) ml-1">(saving...)</span>}
                      </h3>
                      <div className="flex gap-2 items-center text-xs">
                          <span className="px-2 py-1 bg-(--accent-soft) text-(--accent) font-semibold rounded-md uppercase">{u.role}</span>
                          {u.branch && <span className="text-(--text-muted)">{u.branch.name}</span>}
                      </div>
                    </div>
                    {!u._pending && (
                      <div className="flex gap-1">
                         <button onClick={() => setEditingUserId(u.id)} disabled={pendingUserOps.has(u.id)} className="w-8 h-8 flex items-center justify-center bg-(--bg-elevated) hover:text-blue-500 rounded-lg transition-colors border border-(--border) disabled:opacity-40">
                             <Pencil size={14} />
                         </button>
                         {u.id !== originalAdminId && (
                           <button onClick={() => handleDeleteUser(u.id)} disabled={pendingUserOps.has(u.id)} className="w-8 h-8 flex items-center justify-center bg-(--bg-elevated) hover:text-(--red) hover:bg-red-500/10 rounded-lg transition-colors border border-(--border) disabled:opacity-40">
                               <Trash size={14} />
                           </button>
                         )}
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
