import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff } from "lucide-react";

import { AuthAlert } from "@/components/author/AuthAlert";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";
import { isValidEmail } from "@/utils/passwordPolicy";

function friendlyLoginError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid email or password") || lower.includes("invalid credentials")) {
    return "Wrong email or password. Please check both and try again.";
  }
  if (lower.includes("too many")) {
    return "Too many login attempts. Please wait 15 minutes and try again.";
  }
  if (lower.includes("valid email")) {
    return "Enter a valid email address (e.g. you@university.edu).";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Cannot reach the server. Make sure the backend is running, then try again.";
  }
  return raw || "Sign in failed. Please check your email and password.";
}

export function AuthorLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuthorAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/author/dashboard" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address (e.g. you@university.edu).");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setSubmitting(true);
      await login(email.trim().toLowerCase(), password);
      const dest =
        ((location.state as { from?: { pathname?: string } } | null)?.from?.pathname as string | undefined) ??
        "/author/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(friendlyLoginError(err instanceof Error ? err.message : ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white shadow-lg">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to your author portal</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <AuthAlert message={error} title="Sign in failed" />

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors"
                placeholder="you@university.edu"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors"
                  placeholder="Your password"
                />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide" : "Show"}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm">
              {submitting ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            <p className="text-slate-500">
              New author?{" "}
              <Link to="/author/register" className="font-semibold text-green-600 hover:underline">Create account</Link>
            </p>
            <p className="text-slate-400">
              Staff?{" "}
              <Link to="/admin/login" className="text-slate-500 hover:text-green-600 hover:underline">Admin login</Link>
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xs font-semibold text-slate-500 mb-1">Demo account</p>
            <p className="font-mono text-xs text-slate-600">author.demo@scripthive.org</p>
            <p className="font-mono text-xs text-slate-600">Author@ScriptHive123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
