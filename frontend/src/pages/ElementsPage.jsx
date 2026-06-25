import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useActiveProject } from "@/auth/ProjectContext";
import { Boxes, Plus, Trash2, Folder, ChevronLeft, Edit2, Save, X } from "lucide-react";

const LOC_TYPES = ["css", "xpath", "id", "text", "role", "name", "placeholder"];

export default function ElementsPage() {
  const { active } = useActiveProject();
  const [elements, setElements] = useState([]);
  const [openPage, setOpenPage] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", page: "", primary_locator: "", locator_type: "css" });
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!active) return;
    const { data } = await api.get(`/elements?project_id=${active.id}`);
    setElements(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active?.id]);

  const pages = useMemo(() => {
    const groups = new Map();
    for (const e of elements) {
      const key = e.page || "Unsorted";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, items]) => ({ name, items }));
  }, [elements]);

  const pageItems = openPage
    ? (pages.find((p) => p.name === openPage)?.items || [])
    : [];

  const startNew = (page) => {
    setForm({ name: "", page: page || openPage || "", primary_locator: "", locator_type: "css" });
    setEditing(null);
    setShowNew(true);
  };

  const startEdit = (el) => {
    setForm({
      name: el.name, page: el.page || "",
      primary_locator: el.primary_locator, locator_type: el.locator_type,
      alternate_locators: el.alternate_locators || [],
    });
    setEditing(el);
    setShowNew(true);
  };

  const save = async () => {
    setMsg("");
    if (!active) { setMsg("No active project"); return; }
    if (!form.name || !form.primary_locator) { setMsg("Name and locator are required"); return; }
    try {
      const payload = {
        name: form.name, page: form.page,
        primary_locator: form.primary_locator, locator_type: form.locator_type,
        alternate_locators: form.alternate_locators || [],
      };
      if (editing) {
        await api.patch(`/elements/${editing.id}`, payload);
      } else {
        await api.post("/elements", { project_id: active.id, ...payload });
      }
      setShowNew(false); setEditing(null);
      setForm({ name: "", page: "", primary_locator: "", locator_type: "css", alternate_locators: [] });
      load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (el) => {
    if (!window.confirm(`Delete "${el.name}"?`)) return;
    await api.delete(`/elements/${el.id}`);
    load();
  };

  // -------- folder view (pages) --------
  if (!openPage) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Repository</div>
            <h1 className="font-display text-4xl tracking-tighter mt-1">Elements</h1>
            <p className="text-sm text-zinc-500 mt-2">Locators organised by page. Click a page to view its elements.</p>
          </div>
          <button data-testid="new-element-btn" onClick={() => startNew("")} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add element
          </button>
        </div>

        {msg && <div className="text-xs text-amber-400 font-mono">{msg}</div>}

        {showNew && (
          <ElementForm form={form} setForm={setForm} pages={pages.map((p) => p.name)} save={save} cancel={() => { setShowNew(false); setEditing(null); }} editing={editing} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="pages-grid">
          {pages.length === 0 && (
            <div className="col-span-full text-center text-xs text-zinc-600 py-12 border border-dashed border-zinc-800 rounded-sm">
              No elements yet. Add your first one.
            </div>
          )}
          {pages.map((p) => (
            <button
              key={p.name} data-testid={`page-folder-${p.name}`}
              onClick={() => setOpenPage(p.name)}
              className="text-left border border-zinc-800 rounded-sm p-5 bg-zinc-950/60 hover:border-zinc-500 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <Folder className="w-6 h-6 text-zinc-500 group-hover:text-amber-300" />
                <span className="pill border-zinc-800 text-zinc-400">{p.items.length} {p.items.length === 1 ? "element" : "elements"}</span>
              </div>
              <div className="font-display text-2xl tracking-tight mt-3">{p.name}</div>
              <div className="text-xs text-zinc-500 mt-1">
                Avg confidence{" "}
                <span className="font-mono">
                  {(p.items.reduce((s, e) => s + (e.confidence || 0), 0) / p.items.length * 100).toFixed(0)}%
                </span>
                {p.items.some((e) => e.heal_count > 0) && (
                  <> · <span className="font-mono text-amber-400">{p.items.reduce((s, e) => s + (e.heal_count || 0), 0)} heals</span></>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -------- inside a page --------
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <button data-testid="back-to-pages" onClick={() => setOpenPage(null)} className="text-zinc-400 hover:text-white flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Pages
        </button>
        <span className="text-zinc-700">/</span>
        <span className="font-display text-lg tracking-tight">{openPage}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 ml-auto">{pageItems.length} elements</span>
        <button data-testid="add-element-in-page" onClick={() => startNew(openPage)} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add element
        </button>
      </div>

      {msg && <div className="text-xs text-amber-400 font-mono">{msg}</div>}

      {showNew && (
        <ElementForm form={form} setForm={setForm} pages={pages.map((p) => p.name)} save={save} cancel={() => { setShowNew(false); setEditing(null); }} editing={editing} />
      )}

      <div className="border border-zinc-800 rounded-sm bg-zinc-950/60 overflow-hidden" data-testid="elements-in-page">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <tr className="border-b border-zinc-900">
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Primary locator</th>
              <th className="text-left px-4 py-2">Alternates</th>
              <th className="text-left px-4 py-2">Confidence</th>
              <th className="text-left px-4 py-2">Heals</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && <tr><td colSpan={7} className="text-center text-zinc-600 py-6 text-xs">No elements on this page yet.</td></tr>}
            {pageItems.map((e) => (
              <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                <td className="px-4 py-2 text-sm flex items-center gap-2"><Boxes className="w-3.5 h-3.5 text-zinc-500" />{e.name}</td>
                <td className="px-4 py-2 text-xs font-mono">{e.locator_type}</td>
                <td className="px-4 py-2 text-xs font-mono text-zinc-300 truncate max-w-xs">{e.primary_locator}</td>
                <td className="px-4 py-2 text-xs font-mono text-zinc-400">{(e.alternate_locators || []).length}</td>
                <td className="px-4 py-2 text-xs font-mono">
                  <span className={e.confidence > 0.7 ? "status-pass" : "status-running"}>{(e.confidence * 100).toFixed(0)}%</span>
                </td>
                <td className="px-4 py-2 text-xs font-mono text-zinc-500">{e.heal_count}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => startEdit(e)} className="text-zinc-500 hover:text-white" data-testid={`edit-element-${e.id}`}><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(e)} className="text-zinc-600 hover:text-red-400" data-testid={`delete-element-${e.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ElementForm({ form, setForm, pages, save, cancel, editing }) {
  const addAlt = () => setForm({ ...form, alternate_locators: [...(form.alternate_locators || []), { locator: "", type: "css", weight: 0.5 }] });
  const updAlt = (i, patch) => setForm({ ...form, alternate_locators: (form.alternate_locators || []).map((a, idx) => idx === i ? { ...a, ...patch } : a) });
  const rmAlt = (i) => setForm({ ...form, alternate_locators: (form.alternate_locators || []).filter((_, idx) => idx !== i) });
  return (
    <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3" data-testid="element-form">
      <div className="flex items-center justify-between">
        <div className="font-display text-xl tracking-tight">{editing ? "Edit element" : "Add element"}</div>
        <button onClick={cancel} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-12 gap-3">
        <input data-testid="el-name" placeholder="Element name (e.g. Login Button)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="col-span-6 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
        <input data-testid="el-page" placeholder="Page (e.g. Login)" value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })}
          list="pages-suggestions" className="col-span-4 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
        <datalist id="pages-suggestions">{pages.map((p) => <option key={p} value={p} />)}</datalist>
        <select value={form.locator_type} onChange={(e) => setForm({ ...form, locator_type: e.target.value })}
          className="col-span-2 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm font-mono">
          {LOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Primary locator</div>
        <input data-testid="el-locator" placeholder='button[type="submit"]' value={form.primary_locator} onChange={(e) => setForm({ ...form, primary_locator: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-sm font-mono px-3 py-2 rounded-sm" />
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Alternate locators (with weight) — runner tries highest weight first</div>
        {(form.alternate_locators || []).map((a, i) => (
          <div key={i} className="flex gap-1 mb-1" data-testid={`el-alt-row-${i}`}>
            <select value={a.type} onChange={(e) => updAlt(i, { type: e.target.value })} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1.5 rounded-sm font-mono">
              {LOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={a.locator} onChange={(e) => updAlt(i, { locator: e.target.value })} placeholder="alternate locator" className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1.5 rounded-sm" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-zinc-500">weight</span>
              <input type="number" step="0.05" min="0" max="1" value={a.weight ?? 0.5}
                onChange={(e) => updAlt(i, { weight: Math.max(0, Math.min(1, parseFloat(e.target.value || 0))) })}
                className="w-16 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1.5 rounded-sm" />
            </div>
            <button onClick={() => rmAlt(i)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button onClick={addAlt} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add alternate</button>
      </div>
      <div className="flex gap-2">
        <button data-testid="el-save" onClick={save} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
          <Save className="w-3.5 h-3.5" /> {editing ? "Save changes" : "Add"}
        </button>
        <button onClick={cancel} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
      </div>
    </div>
  );
}
