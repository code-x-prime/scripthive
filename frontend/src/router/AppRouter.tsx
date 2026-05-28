import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminLayout } from "../components/admin/AdminLayout";
import { AdminLoginPage } from "../pages/admin/AdminLoginPage";
import { DashboardPage } from "../pages/admin/DashboardPage";
import { PaymentsPage } from "../pages/admin/PaymentsPage";
import { ReportsPage } from "../pages/admin/ReportsPage";
import { SubmissionsPage } from "../pages/admin/SubmissionsPage";
import { HomePage } from "../pages/public/HomePage";

import { PaymentPage } from "../pages/public/PaymentPage";
import { SubmitPage } from "../pages/public/SubmitPage";

const FullScreenLoader = () => <div className="p-6">Loading...</div>;

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

export const AppRouter = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/submit" element={<SubmitPage />} />
    <Route path="/pay/:invoiceId" element={<PaymentPage />} />
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route
      path="/admin"
      element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="submissions" element={<SubmissionsPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
    </Route>
  </Routes>
);
