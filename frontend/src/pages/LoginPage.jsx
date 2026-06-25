import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Terminal, Loader2 } from "lucide-react";

function formatErr(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return e?.message || "Login failed";
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@intratest.io");
  const [password, setPassword] = useState("Admin@12345");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (e) {
      setErr(formatErr(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-zinc-950">
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-r border-zinc-900">
        <img
          src="https://images.unsplash.com/photo-1498262257252-c282316270bc?crop=entropy&cs=srgb&fm=jpg&q=85"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-black/70 grid-bg" />
        <div className="relative z-10 p-12 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-zinc-700 flex items-center justify-center bg-zinc-950">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="font-display text-lg tracking-tight">IntraTest Studio</div>
          </div>
          <div className="space-y-6">
            <h1 className="font-display text-5xl tracking-tighter leading-[1.05]">
              Enterprise test<br /> automation,<br />
              <span className="text-zinc-500">without the friction.</span>
            </h1>
            <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
              Build, execute and analyse Web, API, Mobile, DB and Visual tests with self-healing locators and a no-code builder. Engineered for QA teams that ship.
            </p>
            <div className="flex gap-4 pt-4">
              <div className="pill border-zinc-700 text-zinc-400">Playwright Engine</div>
              <div className="pill border-zinc-700 text-zinc-400">Self-Healing</div>
              <div className="pill border-zinc-700 text-zinc-400">PostgreSQL</div>
            </div>
          </div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-600">
            v1.0.0 · intranet release
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} data-testid="login-form" className="w-full max-w-sm space-y-6 border border-zinc-800 rounded-sm p-8 bg-zinc-950/80">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Sign in</div>
            <h2 className="font-display text-3xl tracking-tighter mt-2">Welcome back</h2>
            <p className="text-zinc-500 text-sm mt-2">Use your intranet credentials to continue.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">Email</label>
              <input
                data-testid="login-email-input"
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">Password</label>
              <input
                data-testid="login-password-input"
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
          {err && <div data-testid="login-error" className="text-xs text-red-400 border border-red-900/40 bg-red-950/30 p-2 rounded-sm">{err}</div>}
          <button
            data-testid="login-submit-button"
            disabled={loading}
            className="w-full bg-white text-zinc-950 font-medium py-2.5 rounded-sm hover:bg-zinc-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
          </button>
          <div className="text-[11px] text-zinc-500 font-mono">
            Demo: <span className="text-zinc-300">admin@intratest.io / Admin@12345</span>
          </div>
        </form>
      </div>
    </div>
  );
}
