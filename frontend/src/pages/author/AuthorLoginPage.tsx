import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

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
    <div className="min-h-screen flex" style={{background:"#f1f5f9"}}>
      {/* Left panel — navy */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between p-12"
        style={{background:"linear-gradient(160deg,#0f172a 0%,#1e3a8a 100%)"}}>
        <div>
          <div className="flex items-center gap-3 mb-16">
            <img src="/logo.png" alt="ScriptHive" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">ScriptHive</p>
              <p className="text-xs font-semibold" style={{color:"#93c5fd",letterSpacing:"0.08em"}}>AUTHOR PORTAL</p>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Publish your<br/>research globally
          </h2>
          <p className="text-sm leading-relaxed" style={{color:"#94a3b8"}}>
            Submit manuscripts, track peer review, access publication services — all in one place.
          </p>
          <div className="mt-10 space-y-4">
            {["Double-blind peer review","ISSN-supported journals","Fast review in 7–15 days"].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                  style={{background:"rgba(37,99,235,0.4)"}}>
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3"><path d="M2 6l3 3 5-5" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span className="text-sm font-medium" style={{color:"#cbd5e1"}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{color:"#475569"}}>© 2026 ScriptHive Publication. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <img src="/logo.png" alt="ScriptHive" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-bold text-slate-900 text-sm">ScriptHive</p>
              <p className="text-xs text-blue-600 font-semibold tracking-widest">AUTHOR PORTAL</p>
            </div>
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-1">Welcome back</h1>
          <p className="text-sm mb-8" style={{color:"#64748b"}}>Sign in to your author account</p>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            <AuthAlert message={error} title="Sign in failed" />

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email address</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="you@university.edu"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Your password"
                  />
                  <button type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPass((v) => !v)}>
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-60 shadow-lg"
                style={{background:"linear-gradient(135deg,#2563eb,#1e40af)",boxShadow:"0 10px 25px rgba(37,99,235,0.25)"}}>
                {submitting ? "Signing in…" : "Sign In →"}
              </button>
            </form>

            <div className="mt-6 space-y-2.5 text-center text-sm">
              <p><Link to="/author/forgot-password" className="font-semibold text-blue-600 hover:underline">Forgot password?</Link></p>
              <p className="text-slate-500">New author? <Link to="/author/register" className="font-semibold text-blue-600 hover:underline">Create account</Link></p>
              <p className="text-slate-400">Staff? <a href="https://admin.scripthive.org/admin/login" className="text-slate-500 hover:text-blue-600 hover:underline">Admin login</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
