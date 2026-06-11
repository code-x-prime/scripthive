import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { AuthAlert } from "@/components/author/AuthAlert";
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white shadow-lg">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-1.5 text-sm text-slate-500">Enter your registered email to receive a reset link</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="font-semibold text-slate-900">Check your inbox</h2>
              <p className="text-sm text-slate-500">
                If <strong>{email}</strong> is registered, a reset link has been sent. Check spam if not received.
              </p>
              <Link to="/author/login" className="block text-sm font-semibold text-green-600 hover:underline mt-4">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <AuthAlert message={error} title="Request failed" />
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
              <button type="submit" disabled={submitting || !email.trim()}
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm">
                {submitting ? "Sending…" : "Send reset link"}
              </button>
              <p className="text-center text-sm text-slate-500">
                <Link to="/author/login" className="font-semibold text-green-600 hover:underline">← Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
