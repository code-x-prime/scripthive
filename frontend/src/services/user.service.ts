import { apiJson } from "./api";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  roleId: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  role: { id: string; name: string; displayName: string };
}

export const userService = {
  list: () => apiJson<AdminUserRow[]>("/users"),

  create: (body: { name: string; username: string; password: string; roleId: string }) =>
    apiJson<AdminUserRow>("/users", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: { name: string; username: string; roleId: string; isActive: boolean }) =>
    apiJson<AdminUserRow>(`/users/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),

  remove: (id: string) =>
    apiJson<{ message: string }>(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),

  resetPassword: (id: string, newPassword: string) =>
    apiJson<{ message: string }>(`/users/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword })
    })
};
