import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, FolderKanban, Archive } from "lucide-react";
import { Link } from "react-router-dom";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await api.get("/projects");
    setProjects(data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await api.post("/projects", { name, key: key || name.toUpperCase().replace(/\s+/g, "_").slice(0, 10), description, tags: [] });
      setShowCreate(false); setName(""); setKey(""); setDescription("");
      load();
    } catch (e) { setErr(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Workspace</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Projects</h1>
        </div>
        <button data-testid="create-project-btn" onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-white text-zinc-950 px-3 py-2 text-sm rounded-sm hover:bg-zinc-200">
          <Plus className="w-4 h-4" /> New project
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3" data-testid="create-project-form">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Name</label>
              <input data-testid="project-name-input" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Key</label>
              <input data-testid="project-key-input" value={key} onChange={(e) => setKey(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-zinc-500" placeholder="MYAPP" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Description</label>
            <textarea data-testid="project-desc-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          </div>
          {err && <div className="text-xs text-red-400">{err}</div>}
          <div className="flex gap-2">
            <button data-testid="project-save-btn" className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="projects-grid">
        {projects.length === 0 && (
          <div className="text-xs text-zinc-600 col-span-full text-center py-12 border border-dashed border-zinc-800 rounded-sm">
            No projects yet. Click "New project" to get started.
          </div>
        )}
        {projects.map((p) => (
          <Link key={p.id} to={`/builder?project=${p.id}`} data-testid={`project-card-${p.key}`}
            className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 hover:border-zinc-600 transition-colors block">
            <div className="flex items-start justify-between">
              <FolderKanban className="w-5 h-5 text-zinc-500" />
              <span className="pill border-zinc-800 text-zinc-400">{p.key}</span>
            </div>
            <div className="font-display text-xl tracking-tight mt-3">{p.name}</div>
            <div className="text-xs text-zinc-500 mt-1 line-clamp-2 min-h-[2rem]">{p.description || "—"}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mt-3">
              Created {new Date(p.created_at).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
