import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthAlert } from "@/components/author/AuthAlert";
import { AuthPageLayout } from "@/components/author/AuthPageLayout";
import { isValidEmail } from "@/utils/passwordPolicy";

export function AuthorForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) { setError("Enter a valid email address."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/author/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? "Request failed");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout title="Reset your password" subtitle="Enter your registered email to receive a reset link">
      {sent ? (
        <div className="text-center space-y-4 py-4">
          <div className="text-5xl">📧</div>
          <h2 className="font-bold text-slate-900">Check your inbox</h2>
          <p className="text-sm text-slate-500">
            If <strong>{email}</strong> is registered, a reset link has been sent. Check spam if not received.
          </p>
          <Link to="/author/login" className="block text-sm font-semibold text-blue-600 hover:underline mt-4">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <AuthAlert message={error} title="Request failed" />
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Email address
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors font-normal normal-case tracking-normal"
              placeholder="you@university.edu"
            />
          </label>
          <button type="submit" disabled={submitting || !email.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white disabled:opacity-60 shadow-lg transition-all"
            style={{ background: "linear-gradient(135deg,#2563eb,#1e40af)", boxShadow: "0 10px 25px rgba(37,99,235,0.25)" }}>
            {submitting ? "Sending…" : "Send Reset Link →"}
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link to="/author/login" className="font-semibold text-blue-600 hover:underline">← Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthPageLayout>
  );
}
