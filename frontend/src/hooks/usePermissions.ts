import { useAuth } from "@/contexts/AuthContext";
import { APP_PAGE_TO_PERMISSION, type AppPageKey } from "@/utils/permissions";

export const usePermissions = () => {
  const { admin } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.role.name === "super_admin" || admin.role.isSuper) return true;
    return admin.role.permissions.includes(permission);
  };

  const isSuperAdmin = (): boolean => admin?.role.name === "super_admin" || admin?.role.isSuper === true;

  const hasAnyPermission = (permissions: string[]): boolean => permissions.some((permission) => hasPermission(permission));

  /** Spec-style page keys mapped to backend `resource:action` permissions. */
  const canAccessPage = (key: AppPageKey): boolean => hasPermission(APP_PAGE_TO_PERMISSION[key]);

  return { hasPermission, isSuperAdmin, hasAnyPermission, canAccessPage };
};
