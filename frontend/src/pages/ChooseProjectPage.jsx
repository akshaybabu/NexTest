import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveProject } from "@/auth/ProjectContext";
import { useAuth } from "@/auth/AuthContext";
import { api } from "@/lib/api";
import { FolderKanban, Plus, ArrowRight, Terminal, LogOut, Loader2 } from "lucide-react";

export default function ChooseProjectPage() {
  const { projects, selectProject, loading, refresh } = useActiveProject();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  // Auto-redirect handled at App level — this page is only shown when no active id
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const pick = (p) => {
    selectProject(p.id);
    nav("/dashboard");
  };

  const create = async (e) => {
    e.preventDefault();
    setCreating(true); setErr("");
    try {
      const { data } = await api.post("/projects", {
        name,
        key: (key || name).toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 10),
        description: "",
        tags: [],
      });
      selectProject(data.id);
      nav("/dashboard");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to create project");
    } finally { setCreating(false); }
  };

  const handleLogout = async () => { await logout(); nav("/login"); };

  return (
    <div className="min-h-screen bg-zinc-950 grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-zinc-700 flex items-center justify-center bg-zinc-950">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display text-lg tracking-tight">IntraTest Studio</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">signed in as {user?.email}</div>
            </div>
          </div>
          <button data-testid="choose-logout-btn" onClick={handleLogout} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Switch account
          </button>
        </div>

        <div className="mb-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Workspace</div>
          <h1 className="font-display text-5xl tracking-tighter mt-1">Choose a project</h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-xl">
            Pick the project you'll be working in. Test cases, suites, executions, data and elements are scoped to it. You can switch any time from the top header.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading projects…</div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="choose-project-grid">
            {projects.map((p) => (
              <button
                key={p.id}
                data-testid={`choose-project-${p.key}`}
                onClick={() => pick(p)}
                className="text-left border border-zinc-800 rounded-sm p-5 bg-zinc-950/60 hover:border-zinc-500 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <FolderKanban className="w-6 h-6 text-zinc-500" />
                  <span className="pill border-zinc-800 text-zinc-400">{p.key}</span>
                </div>
                <div className="font-display text-2xl tracking-tight mt-3">{p.name}</div>
                <div className="text-xs text-zinc-500 mt-1 line-clamp-2 min-h-[2rem]">{p.description || "—"}</div>
                <div className="mt-4 flex items-center text-xs font-mono uppercase tracking-widest text-zinc-500 group-hover:text-white">
                  Enter <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            ))}

            {!showCreate && (
              <button
                data-testid="choose-create-toggle"
                onClick={() => setShowCreate(true)}
                className="text-left border border-dashed border-zinc-800 rounded-sm p-5 bg-zinc-950/40 hover:border-zinc-500 hover:bg-zinc-950/70 transition-colors"
              >
                <Plus className="w-6 h-6 text-zinc-500" />
                <div className="font-display text-2xl tracking-tight mt-3">New project</div>
                <div className="text-xs text-zinc-500 mt-1">Start a fresh workspace with QA / UAT / Stage / Prod environments pre-seeded.</div>
              </button>
            )}
          </div>
        )}

        {showCreate && (
          <form onSubmit={create} className="mt-4 border border-zinc-800 rounded-sm p-5 bg-zinc-950/60 space-y-3" data-testid="choose-create-form">
            <div className="font-display text-xl tracking-tight">Create a new project</div>
            <div className="grid grid-cols-3 gap-3">
              <input data-testid="choose-name" autoFocus required placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)}
                className="col-span-2 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-zinc-500" />
              <input data-testid="choose-key" placeholder="KEY (optional)" value={key} onChange={(e) => setKey(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm font-mono uppercase focus:outline-none focus:border-zinc-500" />
            </div>
            {err && <div className="text-xs text-red-400" data-testid="choose-error">{err}</div>}
            <div className="flex gap-2">
              <button data-testid="choose-create-submit" disabled={creating || !name} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-40">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create & enter
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
            </div>
          </form>
        )}

        {!loading && projects.length === 0 && !showCreate && (
          <div className="text-sm text-zinc-500 mt-4">
            You don't have any projects yet. Create your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
