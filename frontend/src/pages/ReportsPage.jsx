import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export default function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [flaky, setFlaky] = useState([]);
  const [recent, setRecent] = useState([]);
  const [days, setDays] = useState(14);

  useEffect(() => {
    (async () => {
      const [s, t, f, r] = await Promise.all([
        api.get(`/reports/summary?days=${days}`), api.get(`/reports/trend?days=${days}`),
        api.get("/reports/flaky"), api.get("/reports/recent?limit=20"),
      ]);
      setSummary(s.data); setTrend(t.data); setFlaky(f.data); setRecent(r.data);
    })();
  }, [days]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">Analytics</div>
          <h1 className="font-display text-4xl tracking-tighter mt-1">Reports</h1>
        </div>
        <select data-testid="report-days-select" value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="bg-zinc-900 border border-zinc-800 text-sm px-2 py-1.5 rounded-sm">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Pass rate" value={`${summary?.pass_rate ?? 0}%`} color="status-pass" />
        <Stat label="Total runs" value={summary?.total_executions ?? 0} />
        <Stat label="Passed" value={summary?.passed_executions ?? 0} color="status-pass" />
        <Stat label="Failed" value={summary?.failed_executions ?? 0} color="status-fail" />
        <Stat label="Healed steps" value={summary?.self_healed_steps ?? 0} color="status-running" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">Trend</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="#27272A" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="#52525B" fontSize={10} />
                <YAxis stroke="#52525B" fontSize={10} />
                <Tooltip contentStyle={{ background: "#09090B", border: "1px solid #27272A", borderRadius: 2, fontSize: 12 }} />
                <Line type="monotone" dataKey="passed" stroke="#4ADE80" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#F87171" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">Daily volume</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid stroke="#27272A" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="#52525B" fontSize={10} />
                <YAxis stroke="#52525B" fontSize={10} />
                <Tooltip contentStyle={{ background: "#09090B", border: "1px solid #27272A", borderRadius: 2, fontSize: 12 }} />
                <Bar dataKey="total" fill="#FAFAFA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-sm bg-zinc-950/60">
        <div className="px-4 py-2 border-b border-zinc-900 text-[10px] font-mono uppercase tracking-widest text-zinc-500">Flaky tests (last 30d)</div>
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <tr className="border-b border-zinc-900">
              <th className="text-left px-4 py-2">Test case</th>
              <th className="text-left px-4 py-2">Runs</th>
              <th className="text-left px-4 py-2">Passed</th>
              <th className="text-left px-4 py-2">Failed</th>
              <th className="text-left px-4 py-2">Flakiness</th>
            </tr>
          </thead>
          <tbody>
            {flaky.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-600 py-6 text-xs">No flaky tests.</td></tr>}
            {flaky.map((f) => (
              <tr key={f.test_case_id} className="border-b border-zinc-900">
                <td className="px-4 py-2 text-sm">{f.test_case_name}</td>
                <td className="px-4 py-2 text-xs font-mono">{f.runs}</td>
                <td className="px-4 py-2 text-xs font-mono status-pass">{f.passed}</td>
                <td className="px-4 py-2 text-xs font-mono status-fail">{f.failed}</td>
                <td className="px-4 py-2 text-xs font-mono text-amber-400">{f.flakiness}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Stat = ({ label, value, color = "text-white" }) => (
  <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">{label}</div>
    <div className={`font-display text-3xl tracking-tighter mt-2 ${color}`}>{value}</div>
  </div>
);
