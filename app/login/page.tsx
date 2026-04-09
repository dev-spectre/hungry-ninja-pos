"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      const data = await res.json();
      ['tst_cache_products', 'tst_cache_categories', 'tst_cache_transactions', 'tst_cache_expenses', 'tst_cache_inventory'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('user_permissions', JSON.stringify(data.user.permissions || {}));

      if (data.user.role?.includes("SUPER_ADMIN")) {
        router.push("/super-admin");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="w-full max-w-sm rounded-3xl p-6 shadow-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-2xl" style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}>
            T
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--text-primary)" }}>
          Welcome Back
        </h1>
        <p className="text-sm font-medium text-center mb-6" style={{ color: "var(--text-muted)" }}>
          Sign in to your point of sale
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl outline-none font-medium transition-all"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl outline-none font-medium transition-all"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              required
            />
          </div>

          {error && <p className="text-sm text-center" style={{ color: "var(--red)" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
