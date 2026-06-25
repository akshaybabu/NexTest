import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Activity, CheckCircle2, XCircle, Loader2, FolderKanban, ListChecks, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useActiveProject } from "@/auth/ProjectContext";

const StatCard = ({ label, value, icon: Icon, color = "text-white", testId }) => (
  <div data-testid={testId} className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">{label}</div>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div className={`font-display text-3xl tracking-tighter mt-2 ${color}`}>{value}</div>
  </div>
);

const statusColor = (s) => ({
  passed: "status-pass", failed: "status-fail", running: "status-running",
  queued: "status-queued", cancelled: "status-cancelled",
}[s] || "");

export default function DashboardPage() {
  const { active } = useActiveProject();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recent, setRecent] = useState([]);
  const [flaky, setFlaky] = useState([]);

  useEffect(() => {
    (async () => {
      const qs = active ? `?project_id=${active.id}` : "";
      const [s, t, r, f] = await Promise.all([
        api.get("/reports/summary" + qs), api.get("/reports/trend" + qs),
        api.get("/reports/recent" + qs), api.get("/reports/flaky" + qs),
      ]);
      setSummary(s.data); setTrend(t.data); setRecent(r.data); setFlaky(f.data);
    })();
  }, [active]);

  return (
    <div className="p-6 space-y-6 grid-bg min-h-full">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Overview</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Control Room</h1>
        </div>
        {active && (
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Active project</div>
            <div className="font-display text-xl tracking-tight text-zinc-300" data-testid="active-project-label">{active.name}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pass rate" value={`${summary?.pass_rate ?? 0}%`} icon={CheckCircle2} color="status-pass" testId="stat-pass-rate" />
        <StatCard label="Executions (14d)" value={summary?.total_executions ?? 0} icon={Activity} testId="stat-executions" />
        <StatCard label="Failed" value={summary?.failed_executions ?? 0} icon={XCircle} color="status-fail" testId="stat-failed" />
        <StatCard label="Running / Queued" value={summary?.active_executions ?? 0} icon={Loader2} color="status-running" testId="stat-running" />
        <StatCard label="Projects" value={summary?.total_projects ?? 0} icon={FolderKanban} testId="stat-projects" />
        <StatCard label="Test Cases" value={summary?.total_test_cases ?? 0} icon={ListChecks} testId="stat-testcases" />
        <StatCard label="Suites" value={summary?.total_test_suites ?? 0} icon={ListChecks} testId="stat-suites" />
        <StatCard label="Self-healed steps" value={summary?.self_healed_steps ?? 0} icon={Sparkles} color="status-running" testId="stat-healed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-zinc-800 rounded-sm p-4 lg:col-span-2 bg-zinc-950/60">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500 mb-3">Execution trend (14 days)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="#27272A" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="#52525B" fontSize={10} />
                <YAxis stroke="#52525B" fontSize={10} />
                <Tooltip contentStyle={{ background: "#09090B", border: "1px solid #27272A", borderRadius: 2, fontSize: 12 }} />
                <Line type="monotone" dataKey="passed" stroke="#4ADE80" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#F87171" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="total" stroke="#A1A1AA" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500 mb-3">Flaky tests</div>
          {flaky.length === 0 ? (
            <div className="text-xs text-zinc-600 py-6 text-center">No flaky tests detected.</div>
          ) : (
            <ul className="space-y-2">
              {flaky.slice(0, 8).map((f) => (
                <li key={f.test_case_id} className="text-xs flex items-center justify-between">
                  <span className="truncate">{f.test_case_name}</span>
                  <span className="font-mono text-amber-400">{f.flakiness}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border border-zinc-800 rounded-sm bg-zinc-950/60">
        <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">Recent executions</div>
          <Link to="/executions" className="text-xs text-zinc-400 hover:text-white">View all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <tr className="border-b border-zinc-900">
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Steps</th>
              <th className="text-left px-4 py-2">Browser</th>
              <th className="text-left px-4 py-2">Duration</th>
              <th className="text-left px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody data-testid="recent-executions-table">
            {recent.length === 0 && (
              <tr><td colSpan={6} className="text-center text-zinc-600 py-6 text-xs">No executions yet. Create a test case and run it.</td></tr>
            )}
            {recent.map((e) => (
              <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                <td className="px-4 py-2 font-mono text-xs text-zinc-400">{e.id.slice(0, 8)}</td>
                <td className={`px-4 py-2 text-xs font-mono uppercase ${statusColor(e.status)}`}>{e.status}</td>
                <td className="px-4 py-2 text-xs font-mono">{e.passed_steps}/{e.total_steps}</td>
                <td className="px-4 py-2 text-xs">{e.browser}</td>
                <td className="px-4 py-2 text-xs font-mono">{e.duration_ms} ms</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
