import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Play, Layers } from "lucide-react";

export default function TestSuitesPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [suites, setSuites] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [envId, setEnvId] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get("/projects").then((r) => setProjects(r.data)); }, []);
  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api.get(`/test-suites?project_id=${projectId}`),
      api.get(`/test-cases?project_id=${projectId}`),
      api.get(`/projects/${projectId}/environments`),
    ]).then(([s, t, e]) => { setSuites(s.data); setTestCases(t.data); setEnvironments(e.data); setEnvId(e.data[0]?.id || ""); });
  }, [projectId]);

  const create = async () => {
    if (!projectId || !name) return;
    await api.post("/test-suites", { project_id: projectId, name, test_case_ids: selected, parallel: false, tags: [] });
    setName(""); setSelected([]); setShowNew(false);
    const { data } = await api.get(`/test-suites?project_id=${projectId}`); setSuites(data);
  };

  const runSuite = async (s) => {
    setMsg("");
    try {
      const { data } = await api.post("/executions/run", { suite_id: s.id, environment_id: envId || null, browser: "chromium" });
      setMsg(`Suite execution queued: ${data.id.slice(0, 8)}`);
    } catch (e) { setMsg(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Composition</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Test Suites</h1>
        </div>
        <div className="flex items-center gap-2">
          <select data-testid="suites-project-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-sm px-2 py-1.5 rounded-sm">
            <option value="">Select project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button data-testid="new-suite-btn" disabled={!projectId} onClick={() => setShowNew(true)} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-40">
            <Plus className="w-4 h-4" /> New Suite
          </button>
        </div>
      </div>

      {msg && <div className="text-xs text-amber-400 font-mono" data-testid="suite-message">{msg}</div>}

      {showNew && (
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3">
          <input data-testid="suite-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Suite name"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pick test cases ({selected.length})</div>
          <div className="max-h-48 overflow-auto border border-zinc-800 rounded-sm">
            {testCases.map((t) => (
              <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-900 border-b border-zinc-900 cursor-pointer">
                <input type="checkbox" data-testid={`suite-tc-${t.id}`} checked={selected.includes(t.id)}
                  onChange={(e) => setSelected(s => e.target.checked ? [...s, t.id] : s.filter(x => x !== t.id))} />
                <span>{t.name}</span>
                <span className="ml-auto pill border-zinc-800 text-zinc-500">{t.type}</span>
              </label>
            ))}
            {testCases.length === 0 && <div className="text-xs text-zinc-600 text-center py-4">No test cases in this project.</div>}
          </div>
          <div className="flex gap-2">
            <button data-testid="suite-save-btn" onClick={create} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm">Create suite</button>
            <button onClick={() => setShowNew(false)} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="suites-grid">
        {suites.length === 0 && <div className="text-xs text-zinc-600 col-span-full text-center py-12 border border-dashed border-zinc-800 rounded-sm">No suites yet.</div>}
        {suites.map((s) => (
          <div key={s.id} className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60" data-testid={`suite-card-${s.id}`}>
            <Layers className="w-5 h-5 text-zinc-500" />
            <div className="font-display text-xl tracking-tight mt-2">{s.name}</div>
            <div className="text-xs text-zinc-500 mt-1">{(s.test_case_ids || []).length} test cases</div>
            <div className="mt-4 flex items-center gap-2">
              <select value={envId} onChange={(e) => setEnvId(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                <option value="">No env</option>
                {environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button data-testid={`suite-run-${s.id}`} onClick={() => runSuite(s)} className="border border-zinc-700 px-3 py-1 text-xs rounded-sm flex items-center gap-1 hover:bg-zinc-900">
                <Play className="w-3 h-3" /> Run suite
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
