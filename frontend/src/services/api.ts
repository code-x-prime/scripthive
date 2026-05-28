import { applyRefreshedSession } from "@/auth/tokenBridge";
import { parseApiError } from "@/utils/parseApiError";

import type { AdminUser } from "@/types";

let _getToken: () => string | null = () => null;

export const setTokenGetter = (fn: () => string | null) => {
  _getToken = fn;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "GET", credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string; admin?: AdminUser };
      applyRefreshedSession(data.accessToken, data.admin ?? undefined);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}, hasRetried = false): Promise<Response> {
  const token = _getToken();
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`/api${endpoint}`, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !hasRetried && !endpoint.startsWith("/auth/")) {
    const next = await refreshAccessToken();
    if (next) {
      return apiFetch(endpoint, options, true);
    }
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }

  return res;
}

export async function apiJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(endpoint, options);
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return (await res.json()) as T;
}
