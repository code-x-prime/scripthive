/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AdminUser } from "@/types";
import { registerAuthTokenBridge } from "@/auth/tokenBridge";
import { setTokenGetter } from "@/services/api";
import { parseApiError } from "@/utils/parseApiError";

interface AuthContextType {
  admin: AdminUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    setTokenGetter(() => tokenRef.current ?? null);
  }, []);

  useEffect(() => {
    registerAuthTokenBridge({
      setAccessToken,
      setAdmin
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        credentials: "include"
      });
    } catch {
      // ignore
    }
    // Clear idle timestamp so re-login isn't immediately blocked by stale value
    localStorage.removeItem("sh_admin_last_active");
    setAccessToken(null);
    setAdmin(null);
  }, []);

  useEffect(() => {
    const onLogout = () => {
      void logout();
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "GET", credentials: "include" });
        if (!res.ok) throw new Error("No session");
        const data = (await res.json()) as { accessToken: string; admin: AdminUser };
        if (!cancelled) {
          setAccessToken(data.accessToken);
          setAdmin(normalizeAdmin(data.admin));
        }
      } catch {
        if (!cancelled) {
          setAdmin(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/refresh", { credentials: "include" });
        if (!res.ok) throw new Error("refresh failed");
        const data = (await res.json()) as { accessToken: string; admin?: AdminUser };
        setAccessToken(data.accessToken);
        if (data.admin) setAdmin(normalizeAdmin(data.admin));
      } catch {
        void logout();
      }
    }, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accessToken, logout]);

  // 10 min idle auto-logout — persisted via localStorage so reloads don't reset it
  useEffect(() => {
    if (!accessToken) return;
    const IDLE_MS = 10 * 60 * 1000;
    const LS_KEY = "sh_admin_last_active";

    const stampNow = () => localStorage.setItem(LS_KEY, String(Date.now()));
    const reset = () => stampNow();

    // On mount: check if already idle too long
    const last = Number(localStorage.getItem(LS_KEY) || 0);
    if (last > 0 && Date.now() - last > IDLE_MS) {
      setTimeout(() => {
        void logout();
        window.dispatchEvent(new CustomEvent("auth:idle-logout"));
      }, 0);
      return;
    }
    // Stamp now so reload itself counts as activity
    stampNow();

    // Polling check every 30s
    const poll = setInterval(() => {
      const t = Number(localStorage.getItem(LS_KEY) || 0);
      if (Date.now() - t > IDLE_MS) {
        void logout();
        window.dispatchEvent(new CustomEvent("auth:idle-logout"));
      }
    }, 30000);

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "click", "wheel", "pointermove"];
    events.forEach(e => document.addEventListener(e, reset, { passive: true, capture: true }));

    return () => {
      clearInterval(poll);
      events.forEach(e => document.removeEventListener(e, reset, { capture: true }));
    };
  }, [accessToken, logout]);

  const login = async (login: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login, password })
    });

    if (!res.ok) {
      throw new Error(await parseApiError(res, "Login failed. Check your email/username and password."));
    }

    const data = (await res.json()) as { accessToken: string; admin: AdminUser };
    // Stamp fresh activity time so the idle timer starts from now, not from before logout
    localStorage.setItem("sh_admin_last_active", String(Date.now()));
    setAccessToken(data.accessToken);
    setAdmin(normalizeAdmin(data.admin));
  };

  return (
    <AuthContext.Provider
      value={{ admin, accessToken, isLoading, isAuthenticated: !!admin && !!accessToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function normalizeAdmin(a: AdminUser): AdminUser {
  const isSuper = a.role.name === "super_admin";
  return {
    ...a,
    role: { ...a.role, isSuper, permissions: a.role.permissions ?? [] }
  };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
