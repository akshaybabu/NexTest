import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  LayoutDashboard, FolderKanban, Wrench, Layers, PlayCircle,
  BarChart3, Database, Boxes, Cable, ShieldCheck, Terminal, LogOut, Search
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { to: "/projects", label: "Projects", icon: FolderKanban, tid: "nav-projects" },
  { to: "/builder", label: "Test Builder", icon: Wrench, tid: "nav-test-builder" },
  { to: "/suites", label: "Test Suites", icon: Layers, tid: "nav-test-suites" },
  { to: "/executions", label: "Executions", icon: PlayCircle, tid: "nav-executions" },
  { to: "/api-testing", label: "API Testing", icon: Cable, tid: "nav-api-testing" },
  { to: "/reports", label: "Reports", icon: BarChart3, tid: "nav-reports" },
  { to: "/test-data", label: "Test Data", icon: Database, tid: "nav-test-data" },
  { to: "/elements", label: "Elements", icon: Boxes, tid: "nav-elements" },
  { to: "/integrations", label: "Integrations", icon: Cable, tid: "nav-integrations" },
  { to: "/admin", label: "Admin", icon: ShieldCheck, tid: "nav-admin" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const initials = (user?.full_name || user?.email || "U")
    .split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = async () => { await logout(); nav("/login"); };

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      <aside className="w-60 border-r border-zinc-900 flex flex-col shrink-0">
        <div className="h-14 border-b border-zinc-900 flex items-center gap-2 px-4">
          <div className="w-7 h-7 border border-zinc-700 flex items-center justify-center bg-zinc-950">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="font-display text-sm tracking-tight">IntraTest</div>
          <div className="ml-auto text-[9px] font-mono uppercase tracking-widest text-zinc-600">v1.0</div>
        </div>
        <nav className="flex-1 py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to} to={n.to} data-testid={n.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-sm border-l-2 ${
                  isActive
                    ? "border-white bg-zinc-900/70 text-white"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                }`
              }
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-900 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-zinc-800 flex items-center justify-center text-xs font-mono">{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs truncate" data-testid="user-name">{user?.full_name}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500" data-testid="user-role">{user?.role}</div>
          </div>
          <button data-testid="logout-button" onClick={handleLogout} className="text-zinc-500 hover:text-white" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-zinc-900 flex items-center px-6 gap-4 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-2 text-sm text-zinc-400 flex-1">
            <Search className="w-4 h-4 text-zinc-600" />
            <input
              data-testid="global-search"
              placeholder="Search projects, tests, executions..."
              className="bg-transparent border-none focus:outline-none w-full text-sm placeholder:text-zinc-600"
            />
            <span className="kbd">⌘K</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto"><Outlet /></div>
      </main>
    </div>
  );
}
