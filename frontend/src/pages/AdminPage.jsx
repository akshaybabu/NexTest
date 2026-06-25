import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [tab, setTab] = useState("users");

  useEffect(() => {
    (async () => {
      const promises = [api.get("/admin/health").catch(() => null)];
      if (true) {
        promises.push(api.get("/admin/users").catch(() => ({ data: [] })));
        promises.push(api.get("/admin/audit-logs").catch(() => ({ data: [] })));
      }
      const [h, u, l] = await Promise.all(promises);
      setHealth(h?.data); setUsers(u?.data || []); setLogs(l?.data || []);
    })();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">System</div>
        <h1 className="font-display text-4xl tracking-tighter mt-1">Admin</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Status" value={health?.status || "—"} color="status-pass" />
        <Stat label="Database" value={health?.database || "—"} />
        <Stat label="Total users" value={health?.total_users ?? 0} />
        <Stat label="Total orgs" value={health?.total_organizations ?? 0} />
      </div>

      <div className="border-b border-zinc-900 flex gap-4">
        {["users", "audit"].map(t => (
          <button key={t} data-testid={`admin-tab-${t}`} onClick={() => setTab(t)} className={`px-2 py-2 text-xs font-mono uppercase tracking-widest ${tab === t ? "border-b-2 border-white text-white" : "text-zinc-500"}`}>
            {t === "users" ? "Users" : "Audit logs"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="border border-zinc-800 rounded-sm bg-zinc-950/60 overflow-hidden" data-testid="admin-users-table">
          <table className="w-full text-sm">
            <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <tr className="border-b border-zinc-900">
                <th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Role</th><th className="text-left px-4 py-2">Active</th>
                <th className="text-left px-4 py-2">Last login</th></tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-600 py-6 text-xs">No users (or access denied).</td></tr>}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-zinc-900">
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2 text-xs font-mono text-zinc-400">{u.email}</td>
                  <td className="px-4 py-2"><span className="pill border-zinc-700 text-zinc-300">{u.role}</span></td>
                  <td className={`px-4 py-2 text-xs ${u.is_active ? "status-pass" : "status-fail"}`}>{u.is_active ? "yes" : "no"}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="border border-zinc-800 rounded-sm bg-zinc-950/60 overflow-hidden" data-testid="admin-audit-table">
          <table className="w-full text-sm">
            <thead className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <tr className="border-b border-zinc-900">
                <th className="text-left px-4 py-2">When</th><th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Action</th><th className="text-left px-4 py-2">Resource</th></tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={4} className="text-center text-zinc-600 py-6 text-xs">No logs.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-zinc-900">
                  <td className="px-4 py-2 text-xs text-zinc-500 font-mono">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs">{l.user_email || "—"}</td>
                  <td className="px-4 py-2 text-xs font-mono">{l.action}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500 font-mono">{l.resource_type || "—"}{l.resource_id ? ` · ${l.resource_id.slice(0, 8)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value, color = "text-white" }) => (
  <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-950/60">
    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">{label}</div>
    <div className={`font-display text-2xl tracking-tighter mt-2 ${color}`}>{value}</div>
  </div>
);
