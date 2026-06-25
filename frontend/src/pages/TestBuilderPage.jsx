import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Plus, Save, Play, Trash2, GripVertical, FilePlus, Loader2 } from "lucide-react";

export default function TestBuilderPage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const tcId = params.get("tc") || "";

  const [projects, setProjects] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [environments, setEnvironments] = useState([]);

  const [current, setCurrent] = useState(null); // current test case being edited
  const [steps, setSteps] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("web");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [envId, setEnvId] = useState("");

  useEffect(() => {
    (async () => {
      const [p, k] = await Promise.all([api.get("/projects"), api.get("/keywords")]);
      setProjects(p.data); setKeywords(k.data);
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [t, e] = await Promise.all([
        api.get(`/test-cases?project_id=${projectId}`),
        api.get(`/projects/${projectId}/environments`),
      ]);
      setTestCases(t.data); setEnvironments(e.data);
      if (e.data[0]) setEnvId(e.data[0].id);
    })();
  }, [projectId]);

  useEffect(() => {
    if (!tcId) return;
    (async () => {
      const { data } = await api.get(`/test-cases/${tcId}`);
      setCurrent(data); setName(data.name); setDescription(data.description || "");
      setType(data.type); setSteps(data.steps || []);
    })();
  }, [tcId]);

  const grouped = useMemo(() => {
    const g = {};
    keywords.forEach((k) => { (g[k.category] ||= []).push(k); });
    return g;
  }, [keywords]);

  const addStep = (kw) => setSteps((s) => [...s, { keyword: kw.keyword, target: "", value: "", description: kw.label }]);
  const updateStep = (i, patch) => setSteps((s) => s.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeStep = (i) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const moveStep = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= steps.length) return;
    const copy = [...steps]; [copy[i], copy[j]] = [copy[j], copy[i]]; setSteps(copy);
  };

  const startNew = () => {
    setParams({ project: projectId }); setCurrent(null); setName(""); setDescription(""); setType("web"); setSteps([]);
  };

  const save = async () => {
    if (!projectId) { setRunMsg("Pick a project first."); return; }
    if (!name) { setRunMsg("Enter a name."); return; }
    setSaving(true); setRunMsg("");
    try {
      if (current) {
        const { data } = await api.patch(`/test-cases/${current.id}`, { name, description, steps });
        setCurrent(data); setRunMsg("Saved.");
      } else {
        const { data } = await api.post("/test-cases", { project_id: projectId, name, description, type, steps });
        setCurrent(data); setParams({ project: projectId, tc: data.id });
        setRunMsg("Created.");
      }
      const t = await api.get(`/test-cases?project_id=${projectId}`); setTestCases(t.data);
    } catch (e) { setRunMsg(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const run = async () => {
    if (!current) { setRunMsg("Save first."); return; }
    setRunning(true); setRunMsg("");
    try {
      const { data } = await api.post("/executions/run", {
        test_case_id: current.id, environment_id: envId || null, browser: "chromium",
      });
      setRunMsg(`Execution queued: ${data.id.slice(0, 8)}. Go to Executions to view.`);
    } catch (e) { setRunMsg(e?.response?.data?.detail || "Run failed"); }
    finally { setRunning(false); }
  };

  return (
    <div className="flex h-full">
      {/* Left: Test case list + keywords */}
      <aside className="w-64 border-r border-zinc-900 flex flex-col">
        <div className="p-3 border-b border-zinc-900 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Project</div>
          <select data-testid="project-selector" value={projectId} onChange={(e) => setParams({ project: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 text-sm px-2 py-1.5 rounded-sm">
            <option value="">Select project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button data-testid="new-test-case-btn" onClick={startNew} className="w-full flex items-center gap-2 justify-center border border-zinc-800 text-xs py-1.5 rounded-sm hover:bg-zinc-900">
            <FilePlus className="w-3.5 h-3.5" /> New test case
          </button>
        </div>
        <div className="p-3 border-b border-zinc-900">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Test cases ({testCases.length})</div>
          <div className="space-y-1 max-h-48 overflow-auto">
            {testCases.map((t) => (
              <button key={t.id} data-testid={`tc-list-${t.id}`} onClick={() => setParams({ project: projectId, tc: t.id })}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-sm truncate ${tcId === t.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 flex-1 overflow-auto">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Keywords</div>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{cat}</div>
              <div className="space-y-1">
                {items.map((k) => (
                  <button key={k.keyword} data-testid={`kw-${k.keyword}`} onClick={() => addStep(k)}
                    className="w-full text-left text-xs px-2 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-sm flex items-center justify-between">
                    <span>{k.label}</span>
                    <Plus className="w-3 h-3 text-zinc-600" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Middle: steps */}
      <section className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-zinc-900 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <input data-testid="tc-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Test case name"
              className="flex-1 bg-transparent border-none focus:outline-none font-display text-2xl tracking-tight" />
            <select data-testid="tc-type-select" value={type} onChange={(e) => setType(e.target.value)} disabled={!!current}
              className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm font-mono uppercase">
              <option value="web">web</option><option value="api">api</option>
              <option value="db">db</option><option value="visual">visual</option>
            </select>
            <select data-testid="tc-env-select" value={envId} onChange={(e) => setEnvId(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm font-mono uppercase">
              <option value="">No env</option>
              {environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button data-testid="tc-save-btn" onClick={save} disabled={saving}
              className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
            <button data-testid="tc-run-btn" onClick={run} disabled={running || !current}
              className="border border-zinc-700 text-white px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 hover:bg-zinc-900 disabled:opacity-40">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run
            </button>
          </div>
          <input data-testid="tc-desc-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)"
            className="w-full bg-transparent border-none focus:outline-none text-sm text-zinc-400" />
          {runMsg && <div className="text-xs text-amber-400 font-mono" data-testid="builder-message">{runMsg}</div>}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2" data-testid="steps-container">
          {steps.length === 0 && (
            <div className="text-xs text-zinc-600 text-center py-12 border border-dashed border-zinc-800 rounded-sm">
              No steps yet. Click a keyword on the left to add a step.
            </div>
          )}
          {steps.map((s, i) => (
            <div key={i} className="step-card group flex items-start gap-3" data-testid={`step-row-${i}`}>
              <div className="flex flex-col items-center pt-1 text-zinc-600">
                <button onClick={() => moveStep(i, -1)} className="hover:text-white text-[10px]">▲</button>
                <span className="font-mono text-[10px] py-0.5">{i + 1}</span>
                <button onClick={() => moveStep(i, 1)} className="hover:text-white text-[10px]">▼</button>
              </div>
              <div className="flex-1 grid grid-cols-12 gap-2">
                <div className="col-span-3">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Keyword</div>
                  <div className="font-mono text-sm text-white">{s.keyword}</div>
                </div>
                <div className="col-span-4">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Target</div>
                  <input data-testid={`step-target-${i}`} value={s.target || ""} onChange={(e) => updateStep(i, { target: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-zinc-500" />
                </div>
                <div className="col-span-5">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Value</div>
                  <input data-testid={`step-value-${i}`} value={s.value || ""} onChange={(e) => updateStep(i, { value: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-zinc-500" />
                </div>
              </div>
              <button data-testid={`step-delete-${i}`} onClick={() => removeStep(i)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
