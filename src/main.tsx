import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { ApiError } from "./lib/api";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Spinner, ToastProvider } from "./components/ui";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { StudentsPage } from "./pages/Students";
import { StudentPage } from "./pages/Student";
import { GroupsPage, GroupPage } from "./pages/Groups";
import { RequestsPage } from "./pages/Requests";
import { RecommendationsPage } from "./pages/Recommendations";
import { ChatsPage } from "./pages/Chats";
import { BlockedNumbersPage } from "./pages/BlockedNumbers";
import { AuditPage } from "./pages/Audit";
import { AdminsPage } from "./pages/Admins";
import { ApiPage } from "./pages/Api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 10_000,
      // A signed-out session (401) is not worth retrying.
      retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
    },
  },
});

function RequireAdmin({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAdmin>
                    <Layout />
                  </RequireAdmin>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="students/:id" element={<StudentPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="groups/:id" element={<GroupPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="recommendations" element={<RecommendationsPage />} />
                <Route path="chats" element={<ChatsPage />} />
                <Route path="blocked-numbers" element={<BlockedNumbersPage />} />
                <Route path="audit" element={<AuditPage />} />
                <Route path="admins" element={<AdminsPage />} />
                <Route path="api" element={<ApiPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);
