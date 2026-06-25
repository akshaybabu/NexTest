import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Boxes, Plus, Trash2 } from "lucide-react";

export default function ElementsPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [elements, setElements] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", page: "", primary_locator: "", locator_type: "css", alternate_locators: [] });

  useEffect(() => { api.get("/projects").then(r => setProjects(r.data)); }, []);
  useEffect(() => {
    if (!projectId) return setElements([]);
    api.get(`/elements?project_id=${projectId}`).then(r => setElements(r.data));
  }, [projectId]);

  const create = async () => {
    await api.post("/elements", { project_id: projectId, ...form });
    setForm({ name: "", page: "", primary_locator: "", locator_type: "css", alternate_locators: [] });
    setShowNew(false);
    const { data } = await api.get(`/elements?project_id=${projectId}`); setElements(data);
  };
  const remove = async (id) => { await api.delete(`/elements/${id}`); setElements(es => es.filter(e => e.id !== id)); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Repository</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Elements</h1>
        </div>
        <div className="flex gap-2">
          <select data-testid="elements-project-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-sm px-2 py-1.5 rounded-sm">
            <option value="">Select project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button data-testid="new-element-btn" disabled={!projectId} onClick={() => setShowNew(true)} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-40">
            <Plus className="w-4 h-4" /> Add element
          </button>
        </div>
      </div>

      {showNew && (
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input data-testid="el-name" placeholder="Name (e.g. Login Button)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
            <input data-testid="el-page" placeholder="Page (e.g. Login)" value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={form.locator_type} onChange={(e) => setForm({ ...form, locator_type: e.target.value })} className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm">
              <option value="css">css</option><option value="xpath">xpath</option><option value="id">id</option>
              <option value="text">text</option><option value="role">role</option>
            </select>
            <input data-testid="el-locator" placeholder='Primary locator (e.g. button[type="submit"])' value={form.primary_locator} onChange={(e) => setForm({ ...form, primary_locator: e.target.value })}
              className="col-span-2 bg-zinc-900 border border-zinc-800 text-sm font-mono px-3 py-2 rounded-sm" />
          </div>
          <div className="flex gap-2"><button data-testid="el-save" onClick={create} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm">Save</button>
            <button onClick={() => setShowNew(false)} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="border border-zinc-800 rounded-sm bg-zinc-950/60 overflow-hidden" data-testid="elements-table">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <tr className="border-b border-zinc-900">
              <th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Page</th>
              <th className="text-left px-4 py-2">Type</th><th className="text-left px-4 py-2">Primary locator</th>
              <th className="text-left px-4 py-2">Confidence</th><th className="text-left px-4 py-2">Heals</th><th /></tr>
          </thead>
          <tbody>
            {elements.length === 0 && <tr><td colSpan={7} className="text-center text-zinc-600 py-6 text-xs">{projectId ? "No elements yet." : "Select a project."}</td></tr>}
            {elements.map((e) => (
              <tr key={e.id} className="border-b border-zinc-900">
                <td className="px-4 py-2 text-sm flex items-center gap-2"><Boxes className="w-3.5 h-3.5 text-zinc-500" />{e.name}</td>
                <td className="px-4 py-2 text-xs text-zinc-400">{e.page || "—"}</td>
                <td className="px-4 py-2 text-xs font-mono">{e.locator_type}</td>
                <td className="px-4 py-2 text-xs font-mono text-zinc-300 truncate max-w-xs">{e.primary_locator}</td>
                <td className="px-4 py-2 text-xs font-mono"><span className={e.confidence > 0.7 ? "status-pass" : "status-running"}>{(e.confidence * 100).toFixed(0)}%</span></td>
                <td className="px-4 py-2 text-xs font-mono text-zinc-500">{e.heal_count}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => remove(e.id)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
