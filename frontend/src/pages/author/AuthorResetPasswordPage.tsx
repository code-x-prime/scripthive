import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { AuthAlert } from "@/components/author/AuthAlert";
import { PasswordRequirements } from "@/components/author/PasswordRequirements";
import { isPasswordValid, passwordValidationMessage } from "@/utils/passwordPolicy";

export function AuthorResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <p className="text-slate-600">Invalid reset link.</p>
          <Link to="/author/forgot-password" className="mt-4 block text-sm font-semibold text-green-600 hover:underline">
            Request a new one
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const msg = passwordValidationMessage(password);
    if (msg) { setError(msg); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/author/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const d = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(d.message ?? "Reset failed");
      navigate("/author/login", { state: { notice: "Password reset successful. Please sign in." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white shadow-lg">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Set new password</h1>
          <p className="mt-1.5 text-sm text-slate-500">Choose a strong password for your account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <AuthAlert message={error} title="Could not reset password" />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors"
                  placeholder="New password"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordRequirements password={password} showWhenEmpty />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors"
                placeholder="Confirm password"
              />
              {confirm && password !== confirm && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
              )}
            </div>
            <button type="submit"
              disabled={submitting || !isPasswordValid(password) || password !== confirm}
              className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm">
              {submitting ? "Resetting…" : "Reset password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
