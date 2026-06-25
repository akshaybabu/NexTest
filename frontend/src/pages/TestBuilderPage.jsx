import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useActiveProject } from "@/auth/ProjectContext";
import { Plus, Save, Play, Trash2, FilePlus, Loader2, Box, MousePointer, Type, Globe, Clock, CheckCircle2, Cable, PackagePlus, CheckSquare, Square, Variable } from "lucide-react";
import StepWizard from "@/components/StepWizard";

const KIND_ICON = (kw) => {
  if (kw === "click" || kw === "check" || kw === "select") return MousePointer;
  if (kw === "type") return Type;
  if (kw === "navigate") return Globe;
  if (kw === "wait" || kw === "wait_for_element") return Clock;
  if (kw?.startsWith("verify")) return CheckCircle2;
  if (kw === "api_request") return Cable;
  if (kw === "use_component") return Box;
  return MousePointer;
};

function stepPlainEnglish(s) {
  const k = s.keyword;
  const cfg = s.config || {};
  const el = cfg.element_name;
  if (k === "click") return `Click on ${el || s.target || "element"}`;
  if (k === "type") return `Type "${s.value || ""}" into ${el || s.target || "element"}`;
  if (k === "verify_visible") return `Verify ${el || s.target || "element"} is visible`;
  if (k === "verify_text") return `Verify ${el || s.target || "element"} contains "${s.value || ""}"`;
  if (k === "select") return `Select "${s.value || ""}" in ${el || s.target || "dropdown"}`;
  if (k === "check") return `Check ${el || s.target || "checkbox"}`;
  if (k === "wait_for_element") return `Wait for ${el || s.target || "element"}`;
  if (k === "navigate") return `Navigate to ${s.value || s.target}`;
  if (k === "wait") return `Wait ${s.value || s.target || "1"} seconds`;
  if (k === "verify_url") return `Verify URL contains "${s.value}"`;
  if (k === "verify_title") return `Verify page title contains "${s.value}"`;
  if (k === "api_request") return `${cfg.method || s.target || "GET"} ${cfg.url || s.value || ""}`;
  if (k === "use_component") return `Run component "${cfg.component_name || s.target}"`;
  return s.description || k;
}

export default function TestBuilderPage() {
  const [params, setParams] = useSearchParams();
  const { active, activeId } = useActiveProject();
  const projectId = activeId || "";
  const tcId = params.get("tc") || "";

  const [testCases, setTestCases] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [components, setComponents] = useState([]);

  const [current, setCurrent] = useState(null);
  const [steps, setSteps] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("web");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [envId, setEnvId] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [extractDialog, setExtractDialog] = useState(false);
  const [extractName, setExtractName] = useState("");

  useEffect(() => {
    if (tcId) setParams({}, { replace: true });
    setCurrent(null); setName(""); setDescription(""); setSteps([]); setSelected(new Set());
    // eslint-disable-next-line
  }, [activeId]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [t, e, c] = await Promise.all([
        api.get(`/test-cases?project_id=${projectId}`),
        api.get(`/projects/${projectId}/environments`),
        api.get(`/components?project_id=${projectId}`),
      ]);
      setTestCases(t.data); setEnvironments(e.data); setComponents(c.data);
      if (e.data[0]) setEnvId(e.data[0].id);
    })();
  }, [projectId]);

  useEffect(() => {
    if (!tcId) return;
    (async () => {
      const { data } = await api.get(`/test-cases/${tcId}`);
      setCurrent(data); setName(data.name); setDescription(data.description || "");
      setType(data.type); setSteps(data.steps || []);
      setSelected(new Set());
    })();
  }, [tcId]);

  const addStep = (s) => { setSteps((cur) => [...cur, s]); setWizardOpen(false); };
  const removeStep = (i) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const moveStep = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= steps.length) return;
    const copy = [...steps]; [copy[i], copy[j]] = [copy[j], copy[i]]; setSteps(copy);
  };

  // Extracted variables across all api_request steps in the test case
  const declaredVars = steps
    .filter((s) => s.keyword === "api_request")
    .flatMap((s) => (s.config?.extract || []).map((e) => e.name))
    .filter(Boolean);

  const startNew = () => { setParams({}); setCurrent(null); setName(""); setDescription(""); setType("web"); setSteps([]); setSelected(new Set()); };

  const save = async () => {
    if (!projectId) { setRunMsg("No active project."); return; }
    if (!name) { setRunMsg("Enter a name."); return; }
    setSaving(true); setRunMsg("");
    try {
      if (current) {
        const { data } = await api.patch(`/test-cases/${current.id}`, { name, description, steps });
        setCurrent(data); setRunMsg("Saved.");
      } else {
        const { data } = await api.post("/test-cases", { project_id: projectId, name, description, type, steps });
        setCurrent(data); setParams({ tc: data.id }); setRunMsg("Created.");
      }
      const t = await api.get(`/test-cases?project_id=${projectId}`); setTestCases(t.data);
    } catch (e) { setRunMsg(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const run = async () => {
    if (!current) { setRunMsg("Save first."); return; }
    setRunning(true); setRunMsg("");
    try {
      const { data } = await api.post("/executions/run", { test_case_id: current.id, environment_id: envId || null, browser: "chromium" });
      setRunMsg(`Execution queued: ${data.id.slice(0, 8)}. Open Executions for live status.`);
    } catch (e) { setRunMsg(e?.response?.data?.detail || "Run failed"); }
    finally { setRunning(false); }
  };

  return (
    <div className="flex h-full">
      <aside className="w-60 border-r border-zinc-900 flex flex-col">
        <div className="p-3 border-b border-zinc-900 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Active project</div>
          <div className="text-sm font-display tracking-tight" data-testid="tb-active-project">{active?.name || "—"}</div>
          <button data-testid="new-test-case-btn" onClick={startNew} className="w-full flex items-center gap-2 justify-center border border-zinc-800 text-xs py-1.5 rounded-sm hover:bg-zinc-900">
            <FilePlus className="w-3.5 h-3.5" /> New test case
          </button>
        </div>
        <div className="p-3 flex-1 overflow-auto">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Test cases ({testCases.length})</div>
          <div className="space-y-1">
            {testCases.map((t) => (
              <button key={t.id} data-testid={`tc-list-${t.id}`} onClick={() => setParams({ tc: t.id })}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-sm truncate ${tcId === t.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}>
                {t.name}
              </button>
            ))}
            {testCases.length === 0 && <div className="text-[11px] text-zinc-600">No test cases yet.</div>}
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-zinc-900 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <input data-testid="tc-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Test case name"
              className="flex-1 bg-transparent border-none focus:outline-none font-display text-2xl tracking-tight" />
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
          <div className="flex items-center gap-3 text-xs">
            {runMsg && <div className="text-amber-400 font-mono" data-testid="builder-message">{runMsg}</div>}
            {declaredVars.length > 0 && (
              <div className="flex items-center gap-1.5 text-zinc-400" data-testid="declared-variables">
                <Variable className="w-3 h-3" />
                <span className="font-mono">Available variables: </span>
                {declaredVars.map((v) => <span key={v} className="pill border-emerald-700 text-emerald-400">${"{"}{v}{"}"}</span>)}
              </div>
            )}
            {selected.size > 0 && (
              <button data-testid="extract-component-btn" onClick={() => { setExtractName(""); setExtractDialog(true); }} className="ml-auto flex items-center gap-1 border border-zinc-800 px-2 py-1 rounded-sm hover:bg-zinc-900">
                <PackagePlus className="w-3 h-3" /> Extract {selected.size} step(s) to component
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2" data-testid="steps-container">
          {steps.map((s, i) => {
            const Icon = KIND_ICON(s.keyword);
            const isComp = s.keyword === "use_component";
            const isApi = s.keyword === "api_request";
            const checked = selected.has(i);
            return (
              <div key={i} className={`step-card group flex items-start gap-3 ${isComp ? "border-amber-900/60" : isApi ? "border-blue-900/60" : ""}`} data-testid={`step-row-${i}`}>
                <button onClick={() => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="text-zinc-500 hover:text-white mt-1" data-testid={`step-select-${i}`}>
                  {checked ? <CheckSquare className="w-4 h-4 text-white" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="flex flex-col items-center pt-1 text-zinc-600">
                  <button onClick={() => moveStep(i, -1)} className="hover:text-white text-[10px]">▲</button>
                  <span className="font-mono text-[10px] py-0.5">{i + 1}</span>
                  <button onClick={() => moveStep(i, 1)} className="hover:text-white text-[10px]">▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-100">{stepPlainEnglish(s)}</span>
                  </div>
                  {isApi && (s.config?.extract || []).length > 0 && (
                    <div className="text-[10px] font-mono text-emerald-400 mt-1">
                      → extracts: {(s.config.extract || []).map((e) => `\${${e.name}}`).join(", ")}
                    </div>
                  )}
                  {s.config?.page && (
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">on page: {s.config.page}</div>
                  )}
                </div>
                <button data-testid={`step-delete-${i}`} onClick={() => removeStep(i)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          <button data-testid="add-step-btn" onClick={() => setWizardOpen(true)}
            className="w-full border border-dashed border-zinc-800 hover:border-zinc-500 rounded-sm p-4 text-sm text-zinc-400 hover:text-white flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add step
          </button>
          {steps.length === 0 && (
            <div className="text-xs text-zinc-600 text-center py-2">Start by adding your first step.</div>
          )}
        </div>
      </section>

      <StepWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onSave={addStep} components={components} />

      {extractDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" data-testid="extract-dialog">
          <div className="bg-zinc-950 border border-zinc-800 rounded-sm w-full max-w-md">
            <div className="px-5 py-3 border-b border-zinc-900 font-display text-xl tracking-tight">Extract to reusable component</div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-zinc-500">Extracting {selected.size} step{selected.size === 1 ? "" : "s"}.</p>
              <input autoFocus data-testid="extract-name" value={extractName} onChange={(e) => setExtractName(e.target.value)} placeholder="Component name"
                className="w-full bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm" />
            </div>
            <div className="px-5 py-3 border-t border-zinc-900 flex justify-end gap-2">
              <button onClick={() => setExtractDialog(false)} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
              <button data-testid="extract-confirm" disabled={!extractName || !current} onClick={async () => {
                try {
                  await api.post("/components/extract-from-test-case", {
                    test_case_id: current.id, name: extractName,
                    step_indices: Array.from(selected), replace_with_reference: true,
                  });
                  const [tc, comps] = await Promise.all([
                    api.get(`/test-cases/${current.id}`),
                    api.get(`/components?project_id=${projectId}`),
                  ]);
                  setCurrent(tc.data); setSteps(tc.data.steps || []); setComponents(comps.data);
                  setSelected(new Set()); setExtractDialog(false); setRunMsg(`Component "${extractName}" created.`);
                } catch (e) { setRunMsg(e?.response?.data?.detail || "Extract failed"); }
              }} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm disabled:opacity-40">Create component</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
