import type { Role } from "../types";
import { apiJson } from "./api";

export const roleService = {
  list: () => apiJson<Role[]>("/roles"),
  listPermissions: () => apiJson<Array<{ id: string; resource: string; action: string }>>("/roles/permissions"),
  create: (body: { name: string; displayName: string; description?: string; permissionIds: string[] }) =>
    apiJson<Role>("/roles", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: { displayName: string; description?: string; permissionIds: string[] }) =>
    apiJson<Role>(`/roles/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => apiJson<{ message: string }>(`/roles/${encodeURIComponent(id)}`, { method: "DELETE" })
};
