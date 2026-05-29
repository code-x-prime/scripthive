/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AuthorUser } from "@/types";
import { setAuthorTokenGetter, setAuthorTokenRefreshHandler } from "@/services/authorApi";
import { bindAuthorServiceToken } from "@/services/author.service";
import { parseApiError } from "@/utils/parseApiError";

interface AuthorAuthContextType {
  author: AuthorUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
    affiliations?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateAuthor: (author: AuthorUser) => void;
}

const AuthorAuthContext = createContext<AuthorAuthContextType | null>(null);

export function AuthorAuthProvider({ children }: { children: React.ReactNode }) {
  const [author, setAuthor] = useState<AuthorUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    setAuthorTokenGetter(() => tokenRef.current ?? null);
    bindAuthorServiceToken(() => tokenRef.current ?? null);
    setAuthorTokenRefreshHandler((token) => {
      tokenRef.current = token;
      setAccessToken(token);
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/author/auth/logout", {
        method: "POST",
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        credentials: "include"
      });
    } catch {
      // ignore
    }
    setAccessToken(null);
    setAuthor(null);
  }, []);

  useEffect(() => {
    const onLogout = () => {
      void logout();
    };
    window.addEventListener("author:logout", onLogout);
    return () => window.removeEventListener("author:logout", onLogout);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;

    // Only attempt author session restore on author routes
    if (!window.location.pathname.startsWith("/author")) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/author/auth/refresh", { method: "GET", credentials: "include" });
        if (!res.ok) throw new Error("No session");
        const data = (await res.json()) as { accessToken: string; author: AuthorUser };
        if (!cancelled) {
          setAccessToken(data.accessToken);
          setAuthor(data.author);
        }
      } catch {
        if (!cancelled) {
          setAuthor(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
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
        const res = await fetch("/api/author/auth/refresh", { credentials: "include" });
        if (!res.ok) throw new Error("refresh failed");
        const data = (await res.json()) as { accessToken: string; author?: AuthorUser };
        setAccessToken(data.accessToken);
        if (data.author) setAuthor(data.author);
      } catch {
        void logout();
      }
    }, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accessToken, logout]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/author/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      throw new Error(await parseApiError(res, "Login failed. Check your email and password."));
    }
    const data = (await res.json()) as { accessToken: string; author: AuthorUser };
    setAccessToken(data.accessToken);
    setAuthor(data.author);
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
    affiliations?: string;
  }) => {
    const res = await fetch("/api/author/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(await parseApiError(res, "Registration failed. Please check your details."));
    }
    const data = (await res.json()) as { accessToken: string; author: AuthorUser };
    setAccessToken(data.accessToken);
    setAuthor(data.author);
  };

  return (
    <AuthorAuthContext.Provider
      value={{
        author,
        accessToken,
        isLoading,
        isAuthenticated: !!author && !!accessToken,
        login,
        register,
        logout,
        updateAuthor: setAuthor
      }}
    >
      {children}
    </AuthorAuthContext.Provider>
  );
}

export function useAuthorAuth() {
  const ctx = useContext(AuthorAuthContext);
  if (!ctx) throw new Error("useAuthorAuth must be inside AuthorAuthProvider");
  return ctx;
}
