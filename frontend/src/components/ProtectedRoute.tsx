import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: string;
  superAdminOnly?: boolean;
}

export function ProtectedRoute({ children, permission, superAdminOnly }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (superAdminOnly && !isSuperAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <span className="text-5xl">🔒</span>
        <h2 className="font-display text-2xl text-gray-800">403 Forbidden</h2>
        <p className="text-gray-500 text-sm">This section requires super admin access.</p>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <span className="text-5xl">⛔</span>
        <h2 className="font-display text-2xl text-gray-800">403 Forbidden</h2>
        <p className="text-gray-500 text-sm">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
