import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";

const KEY = "intratest_active_project_id";
const ProjectContext = createContext(null);
export const useActiveProject = () => useContext(ProjectContext);

export function ActiveProjectProvider({ children }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(KEY) || "");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
      // auto-select if only 1 project & no active
      if (!activeId && data.length === 1) {
        setActiveId(data[0].id);
        localStorage.setItem(KEY, data[0].id);
      }
      // clear active if it's no longer accessible
      if (activeId && !data.find((p) => p.id === activeId)) {
        setActiveId("");
        localStorage.removeItem(KEY);
      }
    } finally {
      setLoading(false);
    }
  }, [user, activeId]);

  const selectProject = (id) => {
    setActiveId(id);
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  };

  useEffect(() => {
    if (user) refresh();
    else { setProjects([]); selectProject(""); }
  }, [user]); // eslint-disable-line

  const active = projects.find((p) => p.id === activeId) || null;

  return (
    <ProjectContext.Provider value={{ projects, activeId, active, selectProject, refresh, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}
