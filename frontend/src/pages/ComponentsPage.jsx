import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useActiveProject } from "@/auth/ProjectContext";
import { Plus, Box, Trash2, Save, X, Edit2, ChevronLeft } from "lucide-react";
import StepWizard from "@/components/StepWizard";

function stepLabel(s) {
  const k = s.keyword; const cfg = s.config || {}; const el = cfg.element_name;
  if (k === "click") return `Click ${el || s.target}`;
  if (k === "type") return `Type "${s.value}" into ${el || s.target}`;
  if (k === "navigate") return `Navigate to ${s.value || s.target}`;
  if (k === "wait") return `Wait ${s.value}s`;
  if (k?.startsWith("verify_")) return `${k.replace("_", " ")}: ${s.value}`;
  if (k === "api_request") return `${cfg.method || "GET"} ${cfg.url || s.value || ""}`;
  if (k === "use_component") return `Component: ${cfg.component_name || s.target}`;
  return k;
}

export default function ComponentsPage() {
  const { active, activeId } = useActiveProject();
  const [components, setComponents] = useState([]);
  const [editor, setEditor] = useState(null); // null | "new" | component object
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState([]);
  const [wizard, setWizard] = useState(false);
  const [refList, setRefList] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!activeId) return;
    const { data } = await api.get(`/components?project_id=${activeId}`);
    setComponents(data); setRefList(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeId]);

  const startNew = () => { setEditor("new"); setName(""); setDescription(""); setSteps([]); };
  const startEdit = (c) => { setEditor(c); setName(c.name); setDescription(c.description || ""); setSteps(c.steps || []); };
  const cancel = () => setEditor(null);

  const save = async () => {
    setMsg("");
    if (!name) { setMsg("Name is required"); return; }
    try {
      if (editor === "new") {
        await api.post("/components", { project_id: activeId, name, description, steps, inputs: [] });
      } else {
        await api.patch(`/components/${editor.id}`, { name, description, steps });
      }
      setEditor(null); load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    await api.delete(`/components/${c.id}`); load();
  };

  if (editor) {
    return (
      <div className="p-6 space-y-4 max-w-3xl">
        <button onClick={cancel} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back to components</button>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">{editor === "new" ? "Create" : "Edit"} component</div>
          <h1 className="font-display text-3xl tracking-tighter mt-1">Reusable component</h1>
        </div>
        {msg && <div className="text-xs text-amber-400 font-mono">{msg}</div>}

        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Name</label>
            <input data-testid="comp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Login Flow"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this component do?"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
          </div>
        </div>

        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Steps ({steps.length})</div>
          </div>
          <div className="space-y-2" data-testid="comp-steps">
            {steps.map((s, i) => (
              <div key={i} className="step-card flex items-center gap-3 group" data-testid={`comp-step-${i}`}>
                <span className="font-mono text-[10px] text-zinc-500 w-6">{i + 1}</span>
                <span className="text-sm flex-1">{stepLabel(s)}</span>
                <button onClick={() => setSteps(s => s.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button data-testid="comp-add-step" onClick={() => setWizard(true)} className="w-full border border-dashed border-zinc-800 hover:border-zinc-500 rounded-sm p-3 text-xs text-zinc-400 hover:text-white flex items-center justify-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Add step
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button data-testid="comp-save" onClick={save} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {editor === "new" ? "Create component" : "Save changes"}
          </button>
          <button onClick={cancel} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
        </div>

        <StepWizard open={wizard} onClose={() => setWizard(false)} onSave={(s) => { setSteps((cur) => [...cur, s]); setWizard(false); }} components={refList} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Reusables</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Components</h1>
          <p className="text-sm text-zinc-500 mt-2">Save common flows once, reuse them everywhere.</p>
        </div>
        <button data-testid="new-component-btn" onClick={startNew} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New component
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="components-grid">
        {components.length === 0 && (
          <div className="col-span-full text-center text-xs text-zinc-600 py-12 border border-dashed border-zinc-800 rounded-sm">
            No components yet for {active?.name || "this project"}. Click "New component" or extract from a test case.
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
