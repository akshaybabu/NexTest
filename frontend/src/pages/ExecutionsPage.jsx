import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCcw } from "lucide-react";

const statusColor = (s) => ({
  passed: "status-pass", failed: "status-fail", running: "status-running",
  queued: "status-queued", cancelled: "status-cancelled",
}[s] || "");

export default function ExecutionsPage() {
  const [execs, setExecs] = useState([]);
  const [active, setActive] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get("/executions");
    setExecs(data);
  };
  useEffect(() => { load(); const i = setInterval(load, 4000); return () => clearInterval(i); }, []);

  const open = async (e) => {
    setActive(e); setLoading(true);
    const { data } = await api.get(`/executions/${e.id}/steps`);
    setSteps(data); setLoading(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Runtime</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Executions</h1>
        </div>
        <button data-testid="refresh-executions-btn" onClick={load} className="border border-zinc-800 text-xs px-3 py-1.5 rounded-sm flex items-center gap-1.5 hover:bg-zinc-900">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-sm bg-zinc-950/60">
          <div className="px-4 py-2 border-b border-zinc-900 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Recent runs</div>
          <table className="w-full text-sm">
            <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <tr className="border-b border-zinc-900">
                <th className="text-left px-3 py-2">ID</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Steps</th>
                <th className="text-left px-3 py-2">Browser</th>
                <th className="text-left px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody data-testid="executions-table">
              {execs.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-600 py-6 text-xs">No executions.</td></tr>}
              {execs.map((e) => (
                <tr key={e.id} data-testid={`execution-row-${e.id}`} onClick={() => open(e)} className={`border-b border-zinc-900 cursor-pointer hover:bg-zinc-900/40 ${active?.id === e.id ? "bg-zinc-900/60" : ""}`}>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">{e.id.slice(0, 8)}</td>
                  <td className={`px-3 py-2 text-xs font-mono uppercase ${statusColor(e.status)}`}>{e.status}</td>
                  <td className="px-3 py-2 text-xs font-mono">{e.passed_steps}/{e.total_steps}</td>
                  <td className="px-3 py-2 text-xs">{e.browser}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-zinc-800 rounded-sm bg-zinc-950/60">
          <div className="px-4 py-2 border-b border-zinc-900 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Step details</div>
            {active && <div className="text-xs font-mono text-zinc-400">{active.id.slice(0, 8)} · {active.duration_ms}ms</div>}
          </div>
          <div className="p-3 max-h-[600px] overflow-auto">
            {!active && <div className="text-xs text-zinc-600 text-center py-12">Select a run to view steps.</div>}
            {loading && <div className="flex items-center justify-center py-6 text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" /></div>}
            {!loading && active && steps.map((s) => (
              <div key={s.id} className="step-card mb-2" data-testid={`exec-step-${s.step_index}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">#{s.step_index + 1}</span>
                    <span className="font-mono text-sm">{s.keyword}</span>
                    {s.healed && <span className="pill border-amber-700 text-amber-400">HEALED</span>}
                  </div>
                  <span className={`pill border-zinc-800 ${statusColor(s.status)}`}>{s.status}</span>
                </div>
                {(s.target || s.value) && (
                  <div className="mt-2 text-xs font-mono text-zinc-500">
                    {s.target && <div>target: <span className="text-zinc-300">{s.target}</span></div>}
                    {s.value && <div>value: <span className="text-zinc-300">{s.value}</span></div>}
                  </div>
                )}
                <div className="text-[10px] font-mono text-zinc-600 mt-1">{s.duration_ms}ms</div>
                {s.error_message && <div className="mt-2 text-xs text-red-400 font-mono">{s.error_message}</div>}
                {s.screenshot_url && (
                  <a href={`${process.env.REACT_APP_BACKEND_URL}${s.screenshot_url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-400 mt-2 inline-block">
                    View screenshot →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
