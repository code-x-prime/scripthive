import type { AdminUser, LoginResponse } from "@/types";
import { apiJson } from "@/services/api";

export const authService = {
  login: (email: string, password: string) =>
    apiJson<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  refresh: () => apiJson<{ accessToken: string; admin: AdminUser }>("/auth/refresh"),
  me: () => apiJson<AdminUser>("/auth/me"),
  logout: () => apiJson<{ message: string }>("/auth/logout", { method: "POST" })
};
