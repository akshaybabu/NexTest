import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useActiveProject } from "@/auth/ProjectContext";
import { Plus, Box, Trash2, Save, X, Edit2 } from "lucide-react";

export default function ComponentsPage() {
  const { active, activeId } = useActiveProject();
  const [components, setComponents] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", stepsText: "[]" });
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!activeId) return;
    const { data } = await api.get(`/components?project_id=${activeId}`);
    setComponents(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeId]);

  const startEdit = async (c) => {
    setEditing(c); setShowNew(true);
    setForm({ name: c.name, description: c.description || "", stepsText: JSON.stringify(c.steps || [], null, 2) });
  };

  const save = async () => {
    setMsg("");
    let steps;
    try { steps = JSON.parse(form.stepsText); if (!Array.isArray(steps)) throw new Error("Steps must be a JSON array"); }
    catch (e) { setMsg("Steps must be a valid JSON array"); return; }
    try {
      if (editing) {
        await api.patch(`/components/${editing.id}`, { name: form.name, description: form.description, steps });
      } else {
        await api.post("/components", { project_id: activeId, name: form.name, description: form.description, steps, inputs: [] });
      }
      setShowNew(false); setEditing(null); setForm({ name: "", description: "", stepsText: "[]" });
      load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete component "${c.name}"?`)) return;
    await api.delete(`/components/${c.id}`);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Reusables</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Components</h1>
          <p className="text-sm text-zinc-500 mt-2">Named, reusable blocks of steps. Insert into any test case as a single step.</p>
        </div>
        <button data-testid="new-component-btn" onClick={() => { setEditing(null); setShowNew(true); setForm({ name: "", description: "", stepsText: '[\n  {"keyword":"navigate","value":"https://example.com"}\n]' }); }} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New component
        </button>
      </div>

      {msg && <div className="text-xs text-amber-400 font-mono" data-testid="comp-message">{msg}</div>}

      {showNew && (
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3" data-testid="component-form">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl tracking-tight">{editing ? "Edit component" : "Create reusable component"}</div>
            <button onClick={() => { setShowNew(false); setEditing(null); }} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <input data-testid="comp-name" placeholder="Component name (e.g. Login Flow)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
          <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Steps (JSON array)</label>
            <textarea data-testid="comp-steps" rows={10} value={form.stepsText} onChange={(e) => setForm({ ...form, stepsText: e.target.value })}
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500" />
            <p className="text-[10px] text-zinc-500 mt-1 font-mono">
              Tip: use the Test Builder to compose steps, then "Extract to reusable component" to generate this JSON automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <button data-testid="comp-save" onClick={save} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> {editing ? "Save changes" : "Create"}
            </button>
            <button onClick={() => { setShowNew(false); setEditing(null); }} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="components-grid">
        {components.length === 0 && (
          <div className="col-span-full text-center text-xs text-zinc-600 py-12 border border-dashed border-zinc-800 rounded-sm">
            No components yet for {active?.name || "this project"}. Create one above or extract from a test case.
          </div>
        )}
        {components.map((c) => (
          <div key={c.id} className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60" data-testid={`component-card-${c.id}`}>
            <div className="flex items-start justify-between">
              <Box className="w-5 h-5 text-amber-400" />
              <span className="pill border-zinc-800 text-zinc-400">v{c.version}</span>
            </div>
            <div className="font-display text-xl tracking-tight mt-2">{c.name}</div>
            <div className="text-xs text-zinc-500 mt-1 min-h-[2rem]">{c.description || "—"}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mt-3">{(c.steps || []).length} step(s)</div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => startEdit(c)} className="text-xs border border-zinc-700 px-2 py-1 rounded-sm flex items-center gap-1 hover:bg-zinc-900" data-testid={`edit-comp-${c.id}`}><Edit2 className="w-3 h-3" /> Edit</button>
              <button onClick={() => remove(c)} className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1" data-testid={`delete-comp-${c.id}`}><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
