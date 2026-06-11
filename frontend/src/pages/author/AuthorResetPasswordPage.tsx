import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthAlert } from "@/components/author/AuthAlert";
import { AuthPageLayout } from "@/components/author/AuthPageLayout";
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
      <AuthPageLayout title="Invalid link" subtitle="This reset link is not valid.">
        <div className="text-center py-4">
          <Link to="/author/forgot-password" className="text-sm font-semibold text-blue-600 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </AuthPageLayout>
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
    <AuthPageLayout title="Set new password" subtitle="Choose a strong password for your account">
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthAlert message={error} title="Could not reset password" />
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
          New password
          <div className="relative mt-1.5">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="New password"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors font-normal normal-case tracking-normal"
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="font-normal normal-case tracking-normal">
            <PasswordRequirements password={password} showWhenEmpty />
          </div>
        </label>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Confirm password"
            className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors font-normal normal-case tracking-normal"
          />
          {confirm && password !== confirm && (
            <p className="mt-1 text-xs text-red-600 normal-case tracking-normal font-normal">Passwords do not match.</p>
          )}
        </label>
        <button type="submit"
          disabled={submitting || !isPasswordValid(password) || password !== confirm}
          className="w-full py-3.5 rounded-xl text-sm font-black text-white disabled:opacity-60 shadow-lg transition-all"
          style={{ background: "linear-gradient(135deg,#2563eb,#1e40af)", boxShadow: "0 10px 25px rgba(37,99,235,0.25)" }}>
          {submitting ? "Resetting…" : "Reset Password →"}
        </button>
      </form>
    </AuthPageLayout>
  );
}
