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
