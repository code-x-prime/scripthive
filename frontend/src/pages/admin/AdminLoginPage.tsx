import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, BookOpen, FileText, Users, Award, Shield, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type LoginMode = "team" | "superadmin";

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<LoginMode>("team");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setLoginId("");
    setError("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginId.trim() || !password) {
      setError(
        mode === "superadmin"
          ? "Please enter your email and password."
          : "Please enter your username and password."
      );
      return;
    }
    try {
      setSubmitting(true);
      await login(loginId.trim(), password);
      const dest =
        ((location.state as { from?: { pathname?: string } } | null)?.from?.pathname as string | undefined) ??
        "/admin/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (raw.includes("Unexpected token") || raw.includes("is not valid JSON")) {
        setError("The server returned an unexpected response. Refresh the page or try again in a few minutes.");
      } else if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("network")) {
        setError("Cannot reach the server. Make sure the backend is running, then try again.");
      } else {
        setError(raw || "Login failed. Check your email/username and password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-green-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-heading text-xl font-semibold">ScriptHive</span>
          </div>
          <p className="text-green-200 text-sm">Publication House</p>
        </div>

        <div className="relative z-10">
          <h1 className="font-heading text-4xl text-white leading-tight mb-6">
            Editorial &amp;
            <br />
            Publication
            <br />
            Management
          </h1>
          <p className="text-green-200 text-base leading-relaxed mb-10">
            One secure portal for every team role — editors, reviewers, payment staff, and administrators.
          </p>
          <div className="flex flex-col gap-3">
            {[
              { icon: FileText, label: "Manage submissions & journals" },
              { icon: Users, label: "Role-based team access" },
              { icon: Award, label: "Publish with confidence" }
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-green-200" />
                </div>
                <span className="text-green-100 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-green-400 text-xs">
          © {new Date().getFullYear()} ScriptHive Publication House
        </p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-lg font-semibold text-slate-800">ScriptHive</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose how you access the platform — every role has its own dashboard.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode("team")}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  mode === "team"
                    ? "bg-white text-green-700 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCircle className="h-4 w-4 shrink-0" />
                Team Member
              </button>
              <button
                type="button"
                onClick={() => switchMode("superadmin")}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  mode === "superadmin"
                    ? "bg-white text-green-700 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                Super Admin
              </button>
            </div>

            <div
              className={`mt-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
                mode === "team"
                  ? "border-green-100 bg-green-50 text-green-800"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {mode === "team" ? (
                <>
                  <span className="font-semibold">Editor, reviewer, payment staff, etc.</span>
                  {" "}— sign in with the <strong>username</strong> and password given to you by Super Admin.
                </>
              ) : (
                <>
                  <span className="font-semibold">Super Admin only</span>
                  {" "}— sign in with your <strong>email address</strong> and password.
                </>
              )}
            </div>

            {error && (
              <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  {mode === "team" ? "Username" : "Email address"}
                </label>
                <input
                  type={mode === "superadmin" ? "email" : "text"}
                  placeholder={mode === "team" ? "e.g. editor.rahul" : "admin@scripthive.org"}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={submitting}
                  autoComplete={mode === "team" ? "username" : "email"}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={submitting}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in to dashboard"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Authorized ScriptHive staff only · Contact Super Admin if you need access
          </p>
        </div>
      </div>
    </div>
  );
};
