import { parseApiError } from "@/utils/parseApiError";

let _getAuthorToken: () => string | null = () => null;
let _onAuthorTokenRefresh: ((token: string) => void) | null = null;

export const setAuthorTokenGetter = (fn: () => string | null) => {
  _getAuthorToken = fn;
};

export const setAuthorTokenRefreshHandler = (fn: (token: string) => void) => {
  _onAuthorTokenRefresh = fn;
};

let authorRefreshPromise: Promise<string | null> | null = null;

async function refreshAuthorAccessToken(): Promise<string | null> {
  if (authorRefreshPromise) return authorRefreshPromise;
  authorRefreshPromise = (async () => {
    try {
      const res = await fetch("/api/author/auth/refresh", { method: "GET", credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      _onAuthorTokenRefresh?.(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      authorRefreshPromise = null;
    }
  })();
  return authorRefreshPromise;
}

export async function authorApiFetch(
  endpoint: string,
  options: RequestInit = {},
  hasRetried = false
): Promise<Response> {
  const token = _getAuthorToken();
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`/api/author${endpoint}`, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !hasRetried && !endpoint.startsWith("/auth/")) {
    const next = await refreshAuthorAccessToken();
    if (next) {
      const retryHeaders: HeadersInit = {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${next}`,
        ...(options.headers || {})
      };
      return fetch(`/api/author${endpoint}`, { ...options, headers: retryHeaders, credentials: "include" });
    }
    window.dispatchEvent(new CustomEvent("author:logout"));
  }

  return res;
}

export async function authorApiJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await authorApiFetch(endpoint, options);
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return (await res.json()) as T;
}
