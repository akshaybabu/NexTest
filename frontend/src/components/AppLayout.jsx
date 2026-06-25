import React, { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useActiveProject } from "@/auth/ProjectContext";
import {
  LayoutDashboard, FolderKanban, Wrench, Layers, PlayCircle,
  BarChart3, Database, Boxes, Cable, ShieldCheck, Terminal, LogOut, Search,
  ChevronDown, Repeat, Box,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { to: "/projects", label: "Projects", icon: FolderKanban, tid: "nav-projects" },
  { to: "/builder", label: "Test Builder", icon: Wrench, tid: "nav-test-builder" },
  { to: "/components", label: "Components", icon: Box, tid: "nav-components" },
  { to: "/suites", label: "Test Suites", icon: Layers, tid: "nav-test-suites" },
  { to: "/executions", label: "Executions", icon: PlayCircle, tid: "nav-executions" },
  { to: "/api-testing", label: "API Testing", icon: Cable, tid: "nav-api-testing" },
  { to: "/reports", label: "Reports", icon: BarChart3, tid: "nav-reports" },
  { to: "/test-data", label: "Test Data", icon: Database, tid: "nav-test-data" },
  { to: "/elements", label: "Elements", icon: Boxes, tid: "nav-elements" },
  { to: "/integrations", label: "Integrations", icon: Cable, tid: "nav-integrations" },
  { to: "/admin", label: "Admin", icon: ShieldCheck, tid: "nav-admin" },
];

function ProjectSwitcher() {
  const { projects, active, selectProject } = useActiveProject();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="project-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-zinc-800 px-2.5 py-1.5 rounded-sm hover:bg-zinc-900 text-sm"
      >
        <FolderKanban className="w-3.5 h-3.5 text-zinc-500" />
        <span className="font-mono text-xs text-zinc-300 max-w-[180px] truncate">
          {active ? `${active.key} · ${active.name}` : "No project"}
        </span>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-zinc-950 border border-zinc-800 rounded-sm shadow-xl z-50" data-testid="project-switcher-menu">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-3 pt-2 pb-1">Switch project</div>
          <div className="max-h-72 overflow-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                data-testid={`switch-to-${p.key}`}
                onClick={() => { selectProject(p.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-900 border-l-2 ${
                  active?.id === p.id ? "border-white text-white" : "border-transparent text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="font-mono text-[10px] text-zinc-600">{p.key}</span>
                </div>
              </button>
            ))}
            {projects.length === 0 && <div className="text-xs text-zinc-600 px-3 py-3">No projects.</div>}
          </div>
          <div className="border-t border-zinc-800 p-2">
            <button
              data-testid="open-choose-project"
              onClick={() => { setOpen(false); nav("/choose-project"); }}
              className="w-full text-xs text-zinc-400 hover:text-white px-2 py-1 flex items-center gap-1.5"
            >
              <Repeat className="w-3 h-3" /> Choose another project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
          <div className="flex items-center gap-2 text-sm text-zinc-400 flex-1 min-w-0">
            <Search className="w-4 h-4 text-zinc-600" />
            <input
              data-testid="global-search"
              placeholder="Search projects, tests, executions..."
              className="bg-transparent border-none focus:outline-none text-sm placeholder:text-zinc-600 flex-1 min-w-0"
            />
            <span className="kbd hidden sm:inline-flex">⌘K</span>
          </div>
          <ProjectSwitcher />
        </header>
        <div className="flex-1 overflow-auto"><Outlet /></div>
      </main>
    </div>
  );
}
