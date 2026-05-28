import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";

export function AuthorProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuthorAuth();
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
    return <Navigate to="/author/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
