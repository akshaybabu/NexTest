import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ActiveProjectProvider, useActiveProject } from "@/auth/ProjectContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ChooseProjectPage from "@/pages/ChooseProjectPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import TestBuilderPage from "@/pages/TestBuilderPage";
import TestSuitesPage from "@/pages/TestSuitesPage";
import ExecutionsPage from "@/pages/ExecutionsPage";
import ReportsPage from "@/pages/ReportsPage";
import ApiTestingPage from "@/pages/ApiTestingPage";
import ElementsPage from "@/pages/ElementsPage";
import TestDataPage from "@/pages/TestDataPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import AdminPage from "@/pages/AdminPage";
import { Loader2 } from "lucide-react";

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireProject({ children }) {
  const { activeId, loading } = useActiveProject();
  const loc = useLocation();
  if (loading) return <Loader />;
  if (!activeId) return <Navigate to="/choose-project" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ActiveProjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/choose-project" element={<Protected><ChooseProjectPage /></Protected>} />
            <Route element={<Protected><RequireProject><AppLayout /></RequireProject></Protected>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/builder" element={<TestBuilderPage />} />
              <Route path="/suites" element={<TestSuitesPage />} />
              <Route path="/executions" element={<ExecutionsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/api-testing" element={<ApiTestingPage />} />
              <Route path="/test-data" element={<TestDataPage />} />
              <Route path="/elements" element={<ElementsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ActiveProjectProvider>
    </AuthProvider>
  );
}
