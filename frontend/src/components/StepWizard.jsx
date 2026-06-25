import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useActiveProject } from "@/auth/ProjectContext";
import { X, MousePointer, Type, Globe, Clock, CheckCircle2, Cable, Box, Save, ChevronRight, Plus, Trash2 } from "lucide-react";
import ResponseTree from "@/components/ResponseTree";

// Action catalog — what the user can do, in plain English
const CATEGORIES = [
  { id: "element", label: "Do something on an element", desc: "Click, type, verify visibility / text", icon: MousePointer },
  { id: "navigate", label: "Navigate to a URL", desc: "Open a page", icon: Globe },
  { id: "wait",     label: "Wait", desc: "Pause N seconds", icon: Clock },
  { id: "verify",   label: "Verify URL or page title", desc: "Whole-page assertion", icon: CheckCircle2 },
  { id: "api",      label: "API request", desc: "REST call with assertions & extraction", icon: Cable },
  { id: "component",label: "Use a reusable component", desc: "Insert a saved component", icon: Box },
];

const ELEMENT_ACTIONS = [
  { v: "click",          label: "Click",          needsValue: false },
  { v: "type",           label: "Type text",      needsValue: true,  valueLabel: "Text to type" },
  { v: "verify_visible", label: "Verify visible", needsValue: false },
  { v: "verify_text",    label: "Verify text contains", needsValue: true, valueLabel: "Expected text" },
  { v: "select",         label: "Select dropdown option", needsValue: true, valueLabel: "Option value" },
  { v: "check",          label: "Check checkbox", needsValue: false },
  { v: "wait_for_element", label: "Wait for element", needsValue: false },
];

export default function StepWizard({ open, onClose, onSave, components = [] }) {
  const { activeId } = useActiveProject();
  const [step, setStep] = useState("category"); // category | element | navigate | wait | verify | api | component
  const [cat, setCat] = useState(null);
  const [elements, setElements] = useState([]);
  const [pageFilter, setPageFilter] = useState("");
  const [elementId, setElementId] = useState("");
  const [action, setAction] = useState("click");
  const [value, setValue] = useState("");

  const [url, setUrl] = useState("");
  const [waitSec, setWaitSec] = useState(2);
  const [verifyType, setVerifyType] = useState("verify_url");
  const [verifyValue, setVerifyValue] = useState("");

  // API state
  const [apiMethod, setApiMethod] = useState("GET");
  const [apiUrl, setApiUrl] = useState("");
  const [apiHeaders, setApiHeaders] = useState([]);
  const [apiBody, setApiBody] = useState("");
  const [apiAssertions, setApiAssertions] = useState([{ type: "status_code", operator: "equals", expected: 200 }]);
  const [apiExtract, setApiExtract] = useState([]);
  const [apiTesting, setApiTesting] = useState(false);
  const [apiResp, setApiResp] = useState(null);

  const [componentId, setComponentId] = useState("");

  useEffect(() => {
    if (!open || !activeId) return;
    setStep("category"); setCat(null);
    setElementId(""); setPageFilter(""); setAction("click"); setValue("");
    setUrl(""); setWaitSec(2); setVerifyType("verify_url"); setVerifyValue("");
    setApiUrl(""); setApiBody(""); setApiHeaders([]); setApiResp(null);
    setApiAssertions([{ type: "status_code", operator: "equals", expected: 200 }]);
    setApiExtract([]); setComponentId("");
    api.get(`/elements?project_id=${activeId}`).then((r) => setElements(r.data));
  }, [open, activeId]);

  const pages = useMemo(() => {
    const set = new Set();
    elements.forEach((e) => set.add(e.page || "Unsorted"));
    return Array.from(set).sort();
  }, [elements]);
  const filteredEls = pageFilter ? elements.filter((e) => (e.page || "Unsorted") === pageFilter) : elements;
  const selectedEl = elements.find((e) => e.id === elementId);
  const selectedAction = ELEMENT_ACTIONS.find((a) => a.v === action);

  if (!open) return null;

  const pickCategory = (id) => {
    setCat(id);
    setStep(id);
  };

  const finish = () => {
    let s = null;
    if (cat === "element" && elementId && action) {
      s = {
        keyword: action,
        target: selectedEl?.primary_locator || "",
        value: selectedAction?.needsValue ? value : "",
        description: `${selectedAction?.label} on ${selectedEl?.name}`,
        config: { element_id: elementId, element_name: selectedEl?.name, page: selectedEl?.page || null },
      };
    } else if (cat === "navigate") {
      s = { keyword: "navigate", target: "", value: url, description: `Navigate to ${url}` };
    } else if (cat === "wait") {
      s = { keyword: "wait", target: "", value: String(waitSec), description: `Wait ${waitSec}s` };
    } else if (cat === "verify") {
      s = { keyword: verifyType, target: "", value: verifyValue, description: `${verifyType.replace("_", " ")}: ${verifyValue}` };
    } else if (cat === "api") {
      const headers = {};
      apiHeaders.forEach((h) => { if (h.k) headers[h.k] = h.v; });
      let body = null;
      if (apiBody) { try { body = JSON.parse(apiBody); } catch { body = apiBody; } }
      s = {
        keyword: "api_request", target: apiMethod, value: apiUrl,
        description: `${apiMethod} ${apiUrl}`,
        config: {
          method: apiMethod, url: apiUrl, headers, body, body_type: "json",
          assertions: apiAssertions, extract: apiExtract.filter((e) => e.name && e.path),
        },
      };
    } else if (cat === "component" && componentId) {
      const comp = components.find((c) => c.id === componentId);
      s = { keyword: "use_component", target: componentId, value: "", description: `Component: ${comp?.name}`, config: { component_name: comp?.name } };
    }
    if (s) onSave(s);
  };

  const apiTest = async () => {
    setApiTesting(true); setApiResp(null);
    const headers = {};
    apiHeaders.forEach((h) => { if (h.k) headers[h.k] = h.v; });
    let body = null;
    if (apiBody) { try { body = JSON.parse(apiBody); } catch { body = apiBody; } }
    try {
      const { data } = await api.post("/api-tests/run", {
        method: apiMethod, url: apiUrl, headers, body, body_type: "json",
        assertions: apiAssertions,
      });
      setApiResp(data);
    } catch (e) {
      setApiResp({ error: e?.response?.data?.detail || e.message });
    } finally { setApiTesting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" data-testid="step-wizard">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm w-full max-w-3xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl tracking-tight">Add a step</span>
            {cat && <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500"> · {CATEGORIES.find((c) => c.id === cat)?.label}</span>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" data-testid="wizard-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5">
          {step === "category" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="wizard-categories">
              {CATEGORIES.map((c) => {
                if (c.id === "component" && components.length === 0) return null;
                return (
                  <button key={c.id} data-testid={`cat-${c.id}`} onClick={() => pickCategory(c.id)}
                    className="text-left border border-zinc-800 hover:border-zinc-500 rounded-sm p-4 bg-zinc-950/60 group">
                    <c.icon className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                    <div className="font-display text-lg tracking-tight mt-2">{c.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{c.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === "element" && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">1. Pick a page</div>
                {pages.length === 0 ? (
                  <div className="text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-sm p-4 text-center">
                    No elements yet for this project. Add some in <span className="text-zinc-300">Elements</span> first.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pages.map((p) => (
                      <button key={p} data-testid={`wiz-page-${p}`} onClick={() => { setPageFilter(p); setElementId(""); }}
                        className={`text-xs px-3 py-1.5 rounded-sm border ${pageFilter === p ? "border-white bg-zinc-900 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {pageFilter && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">2. Pick an element</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto">
                    {filteredEls.map((e) => (
                      <button key={e.id} data-testid={`wiz-element-${e.id}`} onClick={() => setElementId(e.id)}
                        className={`text-left text-xs px-3 py-2 rounded-sm border ${elementId === e.id ? "border-white bg-zinc-900" : "border-zinc-800 hover:border-zinc-600"}`}>
                        <div className="text-zinc-100">{e.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{e.primary_locator}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {elementId && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">3. What should we do?</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ELEMENT_ACTIONS.map((a) => (
                      <button key={a.v} data-testid={`wiz-action-${a.v}`} onClick={() => setAction(a.v)}
                        className={`text-xs px-3 py-2 rounded-sm border ${action === a.v ? "border-white bg-zinc-900 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                  {selectedAction?.needsValue && (
                    <div className="mt-3">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">{selectedAction.valueLabel}</div>
                      <input data-testid="wiz-action-value" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
                        placeholder="e.g. user@example.com or ${variable_name}"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "navigate" && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">URL</div>
              <input data-testid="wiz-nav-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com or /relative/path"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono" />
              <div className="text-[11px] text-zinc-500 mt-2">Relative paths are resolved against the selected environment's base URL.</div>
            </div>
          )}

          {step === "wait" && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Seconds (max 10)</div>
              <input data-testid="wiz-wait-sec" type="number" min="0" max="10" value={waitSec} onChange={(e) => setWaitSec(e.target.value)}
                className="w-32 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono" />
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {[{v:"verify_url",l:"URL contains"},{v:"verify_title",l:"Title contains"}].map((o) => (
                  <button key={o.v} data-testid={`wiz-verify-${o.v}`} onClick={() => setVerifyType(o.v)}
                    className={`text-xs px-3 py-1.5 rounded-sm border ${verifyType === o.v ? "border-white bg-zinc-900 text-white" : "border-zinc-800 text-zinc-400"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              <input autoFocus data-testid="wiz-verify-value" value={verifyValue} onChange={(e) => setVerifyValue(e.target.value)} placeholder="Expected substring"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono" />
            </div>
          )}

          {step === "api" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <select value={apiMethod} onChange={(e) => setApiMethod(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-sm font-mono px-2 py-2 rounded-sm">
                  {["GET","POST","PUT","PATCH","DELETE"].map((m) => <option key={m}>{m}</option>)}
                </select>
                <input data-testid="wiz-api-url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.example.com/path"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-sm font-mono px-3 py-2 rounded-sm" />
                <button data-testid="wiz-api-test" onClick={apiTest} disabled={!apiUrl || apiTesting}
                  className="border border-zinc-700 text-xs px-3 py-2 rounded-sm hover:bg-zinc-900 disabled:opacity-40">
                  {apiTesting ? "Testing…" : "Test request"}
                </button>
              </div>

              {apiMethod !== "GET" && (
                <textarea data-testid="wiz-api-body" rows={4} value={apiBody} onChange={(e) => setApiBody(e.target.value)} placeholder='{"key":"value"}'
                  className="w-full bg-zinc-900 border border-zinc-800 text-xs font-mono px-3 py-2 rounded-sm" />
              )}

              <details className="text-xs text-zinc-400 border border-zinc-800 rounded-sm">
                <summary className="px-3 py-2 cursor-pointer">Assertions ({apiAssertions.length})</summary>
                <div className="p-3 space-y-1">
                  {apiAssertions.map((a, i) => (
                    <div key={i} className="flex gap-1">
                      <select value={a.type} onChange={(e) => setApiAssertions(arr => arr.map((x,idx)=>idx===i?{...x,type:e.target.value}:x))} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                        <option value="status_code">Status</option>
                        <option value="response_time_ms">Time</option>
                        <option value="json_path">JSON path</option>
                        <option value="header">Header</option>
                        <option value="body_contains">Body contains</option>
                      </select>
                      <select value={a.operator} onChange={(e) => setApiAssertions(arr => arr.map((x,idx)=>idx===i?{...x,operator:e.target.value}:x))} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                        <option>equals</option><option>not_equals</option><option>less_than</option><option>greater_than</option><option>contains</option>
                      </select>
                      {(a.type === "json_path" || a.type === "header") && (
                        <input value={a.path||""} onChange={(e) => setApiAssertions(arr => arr.map((x,idx)=>idx===i?{...x,path:e.target.value}:x))} className="bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="$.path" />
                      )}
                      <input value={a.expected ?? ""} onChange={(e) => setApiAssertions(arr => arr.map((x,idx)=>idx===i?{...x,expected:e.target.value}:x))} className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Expected" />
                      <button onClick={() => setApiAssertions(arr => arr.filter((_,idx)=>idx!==i))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => setApiAssertions(arr => [...arr,{type:"status_code",operator:"equals",expected:""}])} className="text-xs text-zinc-400 flex items-center gap-1"><Plus className="w-3 h-3"/>Add assertion</button>
                </div>
              </details>

              <details className="text-xs text-zinc-400 border border-zinc-800 rounded-sm" data-testid="wiz-api-extract-panel">
                <summary className="px-3 py-2 cursor-pointer">Extract variables from response (for chaining) — {apiExtract.length}</summary>
                <div className="p-3 space-y-2">
                  {apiExtract.map((e, i) => (
                    <div key={i} className="flex gap-1">
                      <input value={e.name} onChange={(ev) => setApiExtract(arr => arr.map((x,idx)=>idx===i?{...x,name:ev.target.value}:x))} placeholder="variable name" className="w-40 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
                      <input value={e.path} onChange={(ev) => setApiExtract(arr => arr.map((x,idx)=>idx===i?{...x,path:ev.target.value}:x))} placeholder="$.path.to.field" className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
                      <button onClick={() => setApiExtract(arr => arr.filter((_,idx)=>idx!==i))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => setApiExtract(arr => [...arr, { name: "", path: "" }])} className="text-xs text-zinc-400 flex items-center gap-1"><Plus className="w-3 h-3"/>Add extraction</button>
                  {apiResp?.response_body && (
                    <div className="mt-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Response preview — click a field to add</div>
                      <ResponseTree data={apiResp.response_body} onPick={(path) => setApiExtract(arr => [...arr, { name: path.split(".").pop().replace(/[^a-zA-Z0-9_]/g, "_") || "var", path }])} />
                    </div>
                  )}
                </div>
              </details>

              {apiResp && (
                <div className="border border-zinc-800 rounded-sm bg-zinc-950/60" data-testid="wiz-api-response">
                  <div className="px-3 py-1.5 border-b border-zinc-900 text-xs font-mono flex gap-3">
                    <span className={apiResp.status_code >= 200 && apiResp.status_code < 300 ? "status-pass" : "status-fail"}>{apiResp.status_code || "ERR"}</span>
                    <span className="text-zinc-500">{apiResp.response_time_ms}ms</span>
                    {apiResp.overall_passed !== undefined && (
                      <span className={apiResp.overall_passed ? "status-pass ml-auto" : "status-fail ml-auto"}>
                        {apiResp.overall_passed ? "ASSERTIONS PASSED" : "ASSERTIONS FAILED"}
                      </span>
                    )}
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-zinc-300 max-h-48 overflow-auto">{JSON.stringify(apiResp.response_body ?? apiResp.error, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {step === "component" && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Pick a component</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-auto">
                {components.map((c) => (
                  <button key={c.id} data-testid={`wiz-comp-${c.id}`} onClick={() => setComponentId(c.id)}
                    className={`text-left text-xs px-3 py-2 rounded-sm border ${componentId === c.id ? "border-white bg-zinc-900" : "border-zinc-800 hover:border-zinc-600"}`}>
                    <div className="flex items-center gap-1.5"><Box className="w-3 h-3 text-amber-400" />{c.name}</div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{(c.steps || []).length} step(s) · v{c.version}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-900 flex items-center justify-between">
          <button onClick={cat ? () => { setCat(null); setStep("category"); } : onClose} className="text-xs text-zinc-400 hover:text-white">
            {cat ? "← Back" : "Cancel"}
          </button>
          {cat && (
            <button data-testid="wiz-finish" onClick={finish}
              disabled={
                (cat === "element" && (!elementId || !action)) ||
                (cat === "navigate" && !url) ||
                (cat === "verify" && !verifyValue) ||
                (cat === "api" && !apiUrl) ||
                (cat === "component" && !componentId)
              }
              className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-40">
              <Save className="w-3.5 h-3.5" /> Add step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
