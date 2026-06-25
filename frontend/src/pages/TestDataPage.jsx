import React, { useEffect, useState } from "react";
import { api, API_BASE, getAuthToken } from "@/lib/api";
import { useActiveProject } from "@/auth/ProjectContext";
import { Database, Plus, Trash2, Eye, EyeOff, Download, Upload, Sparkles, Save, X } from "lucide-react";

const TYPES = [
  { v: "json", label: "JSON object", hint: "Key/value pairs, nested objects" },
  { v: "csv", label: "CSV / rows", hint: "Tabular data for data-driven runs" },
  { v: "env", label: "Env variables", hint: "Per-environment overrides" },
];

const RANDOM_KINDS = ["string", "number", "email", "uuid"];

export default function TestDataPage() {
  const { activeId } = useActiveProject();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(activeId || "");
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reveal, setReveal] = useState({});

  const [form, setForm] = useState({ name: "", type: "json", is_secure: false, dataText: "{}" });
  const [importing, setImporting] = useState({ name: "", file: null });
  const [genKind, setGenKind] = useState("string");
  const [genLen, setGenLen] = useState(12);
  const [genResult, setGenResult] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get("/projects").then((r) => setProjects(r.data)); }, []);
  useEffect(() => { setProjectId(activeId || ""); }, [activeId]);
  useEffect(() => {
    if (!projectId) { setItems([]); return; }
    refresh();
  }, [projectId]);

  const refresh = async () => {
    const { data } = await api.get(`/test-data?project_id=${projectId}`);
    setItems(data);
  };

  const startEdit = async (td) => {
    setShowNew(false);
    setReveal((r) => ({ ...r, [td.id]: true }));
    const { data } = await api.get(`/test-data/${td.id}?reveal=true`);
    setEditing(data);
    setForm({
      name: data.name,
      type: data.type,
      is_secure: data.is_secure,
      dataText: JSON.stringify(data.data ?? (data.type === "csv" ? [] : {}), null, 2),
    });
  };

  const cancel = () => { setShowNew(false); setEditing(null); setForm({ name: "", type: "json", is_secure: false, dataText: "{}" }); };

  const save = async () => {
    setMsg("");
    let parsed;
    try { parsed = JSON.parse(form.dataText); }
    catch { setMsg("Data is not valid JSON."); return; }
    try {
      if (editing) {
        await api.patch(`/test-data/${editing.id}`, { name: form.name, data: parsed, is_secure: form.is_secure });
        setMsg("Updated.");
      } else {
        await api.post("/test-data", { project_id: projectId, name: form.name, type: form.type, data: parsed, is_secure: form.is_secure });
        setMsg("Created.");
      }
      cancel(); refresh();
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (td) => {
    if (!window.confirm(`Delete "${td.name}"?`)) return;
    await api.delete(`/test-data/${td.id}`);
    refresh();
  };

  const toggleReveal = async (td) => {
    if (reveal[td.id]) {
      setReveal((r) => ({ ...r, [td.id]: false }));
      return;
    }
    const { data } = await api.get(`/test-data/${td.id}?reveal=true`);
    setItems((arr) => arr.map((x) => x.id === td.id ? { ...x, data: data.data } : x));
    setReveal((r) => ({ ...r, [td.id]: true }));
  };

  const importCsv = async () => {
    if (!importing.file || !projectId) return;
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("name", importing.name || importing.file.name);
    fd.append("file", importing.file);
    try {
      await fetch(`${API_BASE}/test-data/import-csv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: fd,
      }).then((r) => { if (!r.ok) throw new Error("Import failed"); });
      setImporting({ name: "", file: null });
      setMsg("CSV imported.");
      refresh();
    } catch (e) { setMsg("Import failed: " + e.message); }
  };

  const exportCsv = (td) => {
    const url = `${API_BASE}/test-data/${td.id}/export.csv`;
    fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${td.name}.csv`;
        a.click();
      });
  };

  const generate = async () => {
    const { data } = await api.post(`/test-data/generate-random?kind=${genKind}&length=${genLen}`);
    setGenResult(String(data.value));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Fixtures</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Test Data</h1>
          <p className="text-sm text-zinc-500 mt-2">JSON datasets, CSV rows, env overrides and secure values per project.</p>
        </div>
        <div className="flex gap-2">
          <select data-testid="td-project-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-sm px-2 py-1.5 rounded-sm">
            <option value="">Select project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button data-testid="new-test-data-btn" disabled={!projectId} onClick={() => { setShowNew(true); setEditing(null); setForm({ name: "", type: "json", is_secure: false, dataText: "{}" }); }} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-40">
            <Plus className="w-4 h-4" /> New record
          </button>
        </div>
      </div>

      {msg && <div className="text-xs text-amber-400 font-mono" data-testid="td-message">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CSV import card */}
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="flex items-center gap-2 text-zinc-300"><Upload className="w-4 h-4" /><span className="text-sm font-medium">Import CSV</span></div>
          <p className="text-xs text-zinc-500 mt-1">Upload a CSV — each row becomes a data record for data-driven runs.</p>
          <div className="mt-3 space-y-2">
            <input data-testid="td-import-name" value={importing.name} onChange={(e) => setImporting({ ...importing, name: e.target.value })} placeholder="Name (optional)" className="w-full bg-zinc-900 border border-zinc-800 text-xs px-2 py-1.5 rounded-sm" />
            <input data-testid="td-import-file" type="file" accept=".csv" onChange={(e) => setImporting({ ...importing, file: e.target.files?.[0] })} className="w-full text-xs text-zinc-400 file:bg-zinc-800 file:border-0 file:text-zinc-200 file:rounded-sm file:px-2 file:py-1 file:mr-2" />
            <button data-testid="td-import-btn" disabled={!projectId || !importing.file} onClick={importCsv} className="w-full text-xs bg-white text-zinc-950 px-3 py-1.5 rounded-sm disabled:opacity-40 flex items-center gap-1.5 justify-center"><Upload className="w-3.5 h-3.5" /> Import</button>
          </div>
        </div>

        {/* Random generator */}
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="flex items-center gap-2 text-zinc-300"><Sparkles className="w-4 h-4" /><span className="text-sm font-medium">Random generator</span></div>
          <p className="text-xs text-zinc-500 mt-1">Generate values for ad-hoc test data.</p>
          <div className="mt-3 flex gap-2">
            <select value={genKind} onChange={(e) => setGenKind(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1.5 rounded-sm">
              {RANDOM_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input type="number" value={genLen} onChange={(e) => setGenLen(parseInt(e.target.value || 8))} className="w-20 bg-zinc-900 border border-zinc-800 text-xs px-2 py-1.5 rounded-sm font-mono" />
            <button data-testid="td-generate-btn" onClick={generate} className="text-xs border border-zinc-700 px-3 py-1.5 rounded-sm hover:bg-zinc-900">Generate</button>
          </div>
          {genResult && (
            <div className="mt-2 text-xs font-mono bg-zinc-900 border border-zinc-800 px-2 py-1.5 rounded-sm break-all" data-testid="td-generate-result">{genResult}</div>
          )}
        </div>

        {/* Tips */}
        <div className="border border-dashed border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="text-zinc-400 text-sm font-medium">Tips</div>
          <ul className="text-xs text-zinc-500 mt-2 space-y-1 list-disc list-inside">
            <li><span className="font-mono">json</span> — store config maps, fixtures, headers.</li>
            <li><span className="font-mono">csv</span> — drive parameterised tests row by row.</li>
            <li><span className="font-mono">env</span> — environment-scoped variables, secrets.</li>
            <li>Mark as <span className="text-amber-400">secure</span> to mask in lists & reports.</li>
          </ul>
        </div>
      </div>

      {(showNew || editing) && (
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3" data-testid="td-form">
          <div className="flex items-center justify-between">
            <div className="font-display text-xl tracking-tight">{editing ? "Edit record" : "New record"}</div>
            <button onClick={cancel} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-12 gap-3">
            <input data-testid="td-name-input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-6 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
            <select data-testid="td-type-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={!!editing} className="col-span-3 bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm font-mono">
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <label className="col-span-3 flex items-center gap-2 text-xs text-zinc-400 px-2">
              <input data-testid="td-secure-checkbox" type="checkbox" checked={form.is_secure} onChange={(e) => setForm({ ...form, is_secure: e.target.checked })} />
              Secure (mask in lists)
            </label>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Data (JSON)</label>
            <textarea data-testid="td-data-input" rows={10} value={form.dataText} onChange={(e) => setForm({ ...form, dataText: e.target.value })}
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500"
              placeholder={form.type === "csv" ? '[{"email":"a@b.com","password":"x"}]' : '{"baseUrl": "https://api.example.com"}'} />
          </div>
          <div className="flex gap-2">
            <button data-testid="td-save-btn" onClick={save} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> {editing ? "Save changes" : "Create"}</button>
            <button onClick={cancel} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="border border-zinc-800 rounded-sm bg-zinc-950/60 overflow-hidden" data-testid="td-table">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <tr className="border-b border-zinc-900">
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Records</th>
              <th className="text-left px-4 py-2">Secure</th>
              <th className="text-left px-4 py-2">Preview</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="text-center text-zinc-600 py-6 text-xs">{projectId ? "No test data yet." : "Select a project to begin."}</td></tr>
            )}
            {items.map((td) => {
              const count = Array.isArray(td.data) ? td.data.length : td.data && typeof td.data === "object" ? Object.keys(td.data).length : 0;
              return (
                <tr key={td.id} className="border-b border-zinc-900 hover:bg-zinc-900/40" data-testid={`td-row-${td.id}`}>
                  <td className="px-4 py-2 text-sm flex items-center gap-2"><Database className="w-3.5 h-3.5 text-zinc-500" />{td.name}</td>
                  <td className="px-4 py-2 text-xs font-mono uppercase">{td.type}</td>
                  <td className="px-4 py-2 text-xs font-mono">{count}</td>
                  <td className="px-4 py-2 text-xs">
                    {td.is_secure ? <span className="pill border-amber-700 text-amber-400">SECURE</span> : <span className="text-zinc-500">—</span>}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-zinc-400 max-w-md truncate">
                    {td.data ? JSON.stringify(td.data).slice(0, 120) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      {td.is_secure && (
                        <button onClick={() => toggleReveal(td)} className="text-zinc-500 hover:text-white" title={reveal[td.id] ? "Hide" : "Reveal"} data-testid={`td-reveal-${td.id}`}>
                          {reveal[td.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {td.type === "csv" && (
                        <button onClick={() => exportCsv(td)} className="text-zinc-500 hover:text-white" title="Export CSV" data-testid={`td-export-${td.id}`}>
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => startEdit(td)} className="text-zinc-500 hover:text-white text-xs" data-testid={`td-edit-${td.id}`}>Edit</button>
                      <button onClick={() => remove(td)} className="text-zinc-600 hover:text-red-400" data-testid={`td-delete-${td.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
