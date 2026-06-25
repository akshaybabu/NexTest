import React, { useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Send, Loader2 } from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export default function ApiTestingPage() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [headers, setHeaders] = useState([{ k: "Content-Type", v: "application/json" }]);
  const [bodyType, setBodyType] = useState("json");
  const [body, setBody] = useState("");
  const [authType, setAuthType] = useState("none");
  const [authCfg, setAuthCfg] = useState({});
  const [assertions, setAssertions] = useState([{ type: "status_code", operator: "equals", expected: 200 }]);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true); setResult(null);
    const headerObj = {};
    headers.forEach((h) => { if (h.k) headerObj[h.k] = h.v; });
    let parsedBody = null;
    if (body) {
      try { parsedBody = bodyType === "json" ? JSON.parse(body) : body; } catch { parsedBody = body; }
    }
    try {
      const { data } = await api.post("/api-tests/run", {
        method, url, headers: headerObj, body: parsedBody, body_type: bodyType,
        auth_type: authType, auth_config: authCfg, assertions,
      });
      setResult(data);
    } catch (e) {
      setResult({ error: e?.response?.data?.detail || e.message, assertions: [], overall_passed: false });
    } finally { setRunning(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Module</div>
        <h1 className="font-display text-4xl tracking-tighter mt-1">API Testing</h1>
      </div>

      <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60 space-y-3">
        <div className="flex gap-2">
          <select data-testid="api-method-select" value={method} onChange={(e) => setMethod(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-sm px-3 py-2 rounded-sm font-mono">
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <input data-testid="api-url-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/endpoint"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-500" />
          <button data-testid="api-send-btn" onClick={run} disabled={running} className="bg-white text-zinc-950 px-4 py-2 text-sm rounded-sm flex items-center gap-1.5 disabled:opacity-50">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Headers</div>
            {headers.map((h, i) => (
              <div key={i} className="flex gap-1 mb-1">
                <input value={h.k} onChange={(e) => setHeaders(hs => hs.map((x, idx) => idx === i ? { ...x, k: e.target.value } : x))}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Key" />
                <input value={h.v} onChange={(e) => setHeaders(hs => hs.map((x, idx) => idx === i ? { ...x, v: e.target.value } : x))}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Value" />
                <button onClick={() => setHeaders(hs => hs.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setHeaders(hs => [...hs, { k: "", v: "" }])} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add header</button>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Auth</div>
            <select value={authType} onChange={(e) => { setAuthType(e.target.value); setAuthCfg({}); }} className="w-full bg-zinc-900 border border-zinc-800 text-xs px-2 py-1.5 rounded-sm">
              <option value="none">None</option><option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option><option value="api_key">API Key</option>
            </select>
            {authType === "bearer" && (
              <input value={authCfg.token || ""} onChange={(e) => setAuthCfg({ token: e.target.value })} placeholder="Token"
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
            )}
            {authType === "basic" && (
              <div className="flex gap-1 mt-1">
                <input value={authCfg.username || ""} onChange={(e) => setAuthCfg(c => ({ ...c, username: e.target.value }))} placeholder="username"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
                <input value={authCfg.password || ""} onChange={(e) => setAuthCfg(c => ({ ...c, password: e.target.value }))} placeholder="password" type="password"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
              </div>
            )}
            {authType === "api_key" && (
              <div className="flex gap-1 mt-1">
                <input value={authCfg.key || ""} onChange={(e) => setAuthCfg(c => ({ ...c, key: e.target.value, in: "header" }))} placeholder="header name"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
                <input value={authCfg.value || ""} onChange={(e) => setAuthCfg(c => ({ ...c, value: e.target.value }))} placeholder="value"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" />
              </div>
            )}
          </div>
        </div>

        {(method !== "GET") && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Body ({bodyType})</div>
            <textarea data-testid="api-body-input" value={body} onChange={(e) => setBody(e.target.value)} rows={6}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-sm px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500"
              placeholder='{"key": "value"}' />
          </div>
        )}

        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Assertions ({assertions.length})</div>
          {assertions.map((a, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <select value={a.type} onChange={(e) => setAssertions(as => as.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}
                className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                <option value="status_code">Status code</option>
                <option value="response_time_ms">Response time (ms)</option>
                <option value="header">Header</option>
                <option value="json_path">JSON path</option>
                <option value="body_contains">Body contains</option>
              </select>
              <select value={a.operator} onChange={(e) => setAssertions(as => as.map((x, idx) => idx === i ? { ...x, operator: e.target.value } : x))}
                className="bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-sm">
                <option value="equals">equals</option><option value="not_equals">not equals</option>
                <option value="less_than">less than</option><option value="greater_than">greater than</option>
                <option value="contains">contains</option>
              </select>
              {(a.type === "json_path" || a.type === "header") && (
                <input value={a.path || ""} onChange={(e) => setAssertions(as => as.map((x, idx) => idx === i ? { ...x, path: e.target.value } : x))}
                  className="bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder={a.type === "header" ? "Header name" : "$.path.to.field"} />
              )}
              <input value={a.expected ?? ""} onChange={(e) => setAssertions(as => as.map((x, idx) => idx === i ? { ...x, expected: e.target.value } : x))}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-mono px-2 py-1 rounded-sm" placeholder="Expected" />
              <button onClick={() => setAssertions(as => as.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setAssertions(as => [...as, { type: "status_code", operator: "equals", expected: "" }])}
            className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add assertion</button>
        </div>
      </div>

      {result && (
        <div className="border border-zinc-800 rounded-sm bg-zinc-950/60" data-testid="api-result">
          <div className="px-4 py-2 border-b border-zinc-900 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Response</div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className={result.status_code >= 200 && result.status_code < 300 ? "status-pass" : "status-fail"}>{result.status_code || "—"}</span>
              <span className="text-zinc-500">{result.response_time_ms}ms</span>
              <span className="text-zinc-500">{result.response_size_bytes}b</span>
              <span className={result.overall_passed ? "pill border-emerald-700 status-pass" : "pill border-red-700 status-fail"}>
                {result.overall_passed ? "PASSED" : "FAILED"}
              </span>
            </div>
          </div>
          {result.error && <div className="px-4 py-2 text-xs text-red-400 font-mono">{result.error}</div>}
          {result.assertions?.length > 0 && (
            <div className="px-4 py-2 border-b border-zinc-900 space-y-1">
              {result.assertions.map((a, i) => (
                <div key={i} className="text-xs font-mono flex items-center gap-2">
                  <span className={a.passed ? "status-pass" : "status-fail"}>{a.passed ? "✓" : "✗"}</span>
                  <span className="text-zinc-400">{a.type} {a.operator} {String(a.expected)}</span>
                  <span className="text-zinc-600 ml-auto">actual: {String(a.actual).slice(0, 60)}</span>
                </div>
              ))}
            </div>
          )}
          <pre className="p-4 text-xs font-mono text-zinc-300 max-h-96 overflow-auto">{JSON.stringify(result.response_body, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
