"use client";

import { useState, useEffect } from "react";
import { Plus, Trash, LogOut, Building, User, Pencil, Play, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"branches" | "users">("branches");
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    document.cookie = 'active_branch_id=; Max-Age=0; path=/;';
    localStorage.removeItem('active_branch_id');
    fetchBranches();
    fetchUsers();
  }, []);

  const fetchBranches = async () => {
    const res = await fetch("/api/branch");
    if (res.ok) setBranches(await res.json());
  };

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = { name: formData.get("name"), address: formData.get("address") };
    
    await fetch("/api/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchBranches();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    fetchUsers();
  };

  const handleEditUser = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    (data as any).id = id;

    await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    setEditingUserId(null);
    fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    fetchUsers();
  };

  const handleDeleteBranch = async (id: string, name: string) => {
    if (!confirm(`Delete branch ${name}? This will delete all products, inventory, and users tied to this branch!`)) return;
    await fetch(`/api/branch?id=${id}`, { method: "DELETE" });
    fetchBranches();
  };

  const handleEditBranch = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = { id, name: formData.get("name"), address: formData.get("address") };
    
    await fetch("/api/branch", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingBranchId(null);
    fetchBranches();
  };

  const handleViewBranch = (id: string) => {
     ['tst_cache_products', 'tst_cache_categories', 'tst_cache_transactions', 'tst_cache_expenses', 'tst_cache_inventory'].forEach(k => localStorage.removeItem(k));
     document.cookie = `active_branch_id=${id}; path=/;`;
     localStorage.setItem('active_branch_id', id);
     router.push("/");
  };

  const handleLogout = async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user_role');
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
            <form onSubmit={handleCreateBranch} className="space-y-3 bg-(--bg-card) p-4 rounded-xl border border-(--border)">
              <input name="name" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Branch Name" required />
              <input name="address" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Address / Location" required />
              <button 
                 type="submit" 
                 className="w-full p-3 bg-(--accent) text-white font-semibold rounded-xl active:scale-95 transition-all text-sm flex justify-center items-center gap-2"
              >
                  <Plus size={18} /> Create Branch
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
                  <div key={b.id} className="p-4 bg-(--bg-card) border border-(--border) rounded-xl flex flex-col items-start gap-3">
                    <div className="w-full flex justify-between items-start">
                       <div>
                          <h3 className="font-bold">{b.name}</h3>
                          <span className="text-sm text-(--text-secondary)">{b.address || "No address"}</span>
                       </div>
                       <div className="flex gap-1">
                          <button onClick={() => setEditingBranchId(b.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-(--bg-elevated) hover:text-blue-500"><Pencil size={14}/></button>
                          <button onClick={() => handleDeleteBranch(b.id, b.name)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-(--bg-elevated) hover:text-red-500"><Trash size={14}/></button>
                       </div>
                    </div>
                    <button onClick={() => handleViewBranch(b.id)} className="w-full py-2 bg-(--accent-soft) text-(--accent) font-semibold rounded-lg text-sm flex justify-center items-center gap-2 hover:opacity-80 transition-opacity">
                        <Play size={14} /> Open Point of Sale
                    </button>
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
            <form onSubmit={handleCreateUser} className="space-y-3 bg-(--bg-card) p-4 rounded-xl border border-(--border)">
              <input name="name" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Display Name" required />
              <input name="username" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Username" required />
              <input name="password" type="password" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" placeholder="Password" required />
              
              <select name="role" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)" required>
                <option value="">Select Role</option>
                <option value="SUPER_ADMIN">Super Admin (Global)</option>
                <option value="SHOP_MANAGER">Shop Manager</option>
                <option value="BILLING">Billing / Cashier</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="INVENTORY">Inventory Admin</option>
              </select>

              <select name="branchId" className="w-full bg-(--bg-elevated) p-3 rounded-xl border border-(--border)">
                <option value="">Assign to Branch (Optional for Super Admin)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <button 
                 type="submit" 
                 className="w-full p-3 bg-(--accent) text-white font-semibold rounded-xl active:scale-95 transition-all text-sm flex justify-center items-center gap-2"
              >
                  <Plus size={18} /> Create User
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
                     
                     <select name="role" defaultValue={u.role} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)" required>
                        <option value="SUPER_ADMIN">Super Admin (Global)</option>
                        <option value="SHOP_MANAGER">Shop Manager</option>
                        <option value="BILLING">Billing / Cashier</option>
                        <option value="KITCHEN">Kitchen</option>
                        <option value="INVENTORY">Inventory Admin</option>
                     </select>
                     <select name="branchId" defaultValue={u.branchId || ""} className="w-full bg-(--bg-elevated) p-2 text-sm rounded-lg border border-(--border)">
                        <option value="">No Branch (Global)</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                     <div className="flex gap-2 mt-1">
                        <button type="submit" className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-sm flex items-center justify-center"><Check size={16}/></button>
                        <button type="button" onClick={() => setEditingUserId(null)} className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-sm flex items-center justify-center"><X size={16}/></button>
                     </div>
                  </form>
                ) : (
                  <div key={u.id} className="p-4 bg-(--bg-card) border border-(--border) rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm">{u.name} <span className="text-(--text-secondary) font-normal">@{u.username}</span></h3>
                      <div className="flex gap-2 items-center text-xs">
                          <span className="px-2 py-1 bg-(--accent-soft) text-(--accent) font-semibold rounded-md uppercase">{u.role}</span>
                          {u.branch && <span className="text-(--text-muted)">{u.branch.name}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                       <button onClick={() => setEditingUserId(u.id)} className="w-8 h-8 flex items-center justify-center bg-(--bg-elevated) hover:text-blue-500 rounded-lg transition-colors border border-(--border)">
                           <Pencil size={14} />
                       </button>
                       <button onClick={() => handleDeleteUser(u.id)} className="w-8 h-8 flex items-center justify-center bg-(--bg-elevated) hover:text-(--red) hover:bg-red-500/10 rounded-lg transition-colors border border-(--border)">
                           <Trash size={14} />
                       </button>
                    </div>
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
