import React, { useState } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const ASSERT_TYPES = [
  { v: "status_code", label: "Status code" },
  { v: "response_time_ms", label: "Response time (ms)" },
  { v: "header", label: "Header" },
  { v: "json_path", label: "JSON path" },
  { v: "body_contains", label: "Body contains" },
];
const OPERATORS = ["equals", "not_equals", "less_than", "greater_than", "contains"];

export default function ApiStepConfigModal({ open, initial, onCancel, onSave }) {
  const [cfg, setCfg] = useState(() => ({
    method: initial?.method || "GET",
    url: initial?.url || "",
    headers: Object.entries(initial?.headers || {}).map(([k, v]) => ({ k, v })) || [],
    body_type: initial?.body_type || "json",
    body: initial?.body ? (typeof initial.body === "string" ? initial.body : JSON.stringify(initial.body, null, 2)) : "",
    assertions: initial?.assertions?.length ? initial.assertions : [{ type: "status_code", operator: "equals", expected: 200 }],
  }));

  if (!open) return null;

  const save = () => {
    const headers = {};
    cfg.headers.forEach((h) => { if (h.k) headers[h.k] = h.v; });
    let body = null;
    if (cfg.body) {
      try { body = cfg.body_type === "json" ? JSON.parse(cfg.body) : cfg.body; }
      catch { body = cfg.body; }
    }
    onSave({
      method: cfg.method,
      url: cfg.url,
      headers,
      body,
      body_type: cfg.body_type,
      assertions: cfg.assertions,
    });
  };

  const setH = (i, patch) => setCfg(c => ({ ...c, headers: c.headers.map((h, idx) => idx === i ? { ...h, ...patch } : h) }));
  const setA = (i, patch) => setCfg(c => ({ ...c, assertions: c.assertions.map((a, idx) => idx === i ? { ...a, ...patch } : a) }));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" data-testid="api-step-modal">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-900">
          <div className="font-display text-xl tracking-tight">Configure API request</div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <select data-testid="api-step-method" value={cfg.method} onChange={(e) => setCfg({ ...cfg, method: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm font-mono">
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input data-testid="api-step-url" value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
              placeholder="https://api.example.com/endpoint or /path (uses env base URL)"
              className="flex-1 bg-zinc-900 border border-zinc-800 text-sm font-mono px-3 py-2 rounded-sm" />
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Headers</div>
            {cfg.headers.map((h, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <input value={h.k} onChange={(e) => setH(i, { k: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Key" />
                <input value={h.v} onChange={(e) => setH(i, { v: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Value" />
                <button onClick={() => setCfg(c => ({ ...c, headers: c.headers.filter((_, idx) => idx !== i) }))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setCfg(c => ({ ...c, headers: [...c.headers, { k: "", v: "" }] }))}
              className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add header</button>
          </div>

          {cfg.method !== "GET" && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Body ({cfg.body_type})</div>
              <textarea data-testid="api-step-body" rows={5} value={cfg.body} onChange={(e) => setCfg({ ...cfg, body: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-xs font-mono px-3 py-2 rounded-sm" placeholder='{"key":"value"}' />
            </div>
          )}

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Assertions ({cfg.assertions.length})</div>
            {cfg.assertions.map((a, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <select value={a.type} onChange={(e) => setA(i, { type: e.target.value })} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                  {ASSERT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
                <select value={a.operator} onChange={(e) => setA(i, { operator: e.target.value })} className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                  {OPERATORS.map((op) => <option key={op}>{op}</option>)}
                </select>
                {(a.type === "json_path" || a.type === "header") && (
                  <input value={a.path || ""} onChange={(e) => setA(i, { path: e.target.value })} className="bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder={a.type === "header" ? "Header" : "$.path"} />
                )}
                <input value={a.expected ?? ""} onChange={(e) => setA(i, { expected: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Expected" />
                <button onClick={() => setCfg(c => ({ ...c, assertions: c.assertions.filter((_, idx) => idx !== i) }))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setCfg(c => ({ ...c, assertions: [...c.assertions, { type: "status_code", operator: "equals", expected: "" }] }))}
              className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add assertion</button>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-zinc-900 flex justify-end gap-2">
          <button onClick={onCancel} className="border border-zinc-800 px-3 py-1.5 text-sm rounded-sm">Cancel</button>
          <button data-testid="api-step-save" onClick={save} className="bg-white text-zinc-950 px-3 py-1.5 text-sm rounded-sm flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save step
          </button>
        </div>
      </div>
    </div>
  );
}
