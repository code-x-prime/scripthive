import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff, ArrowLeft, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { apiJson } from "@/services/api";

type Step = "email" | "otp" | "reset" | "done";

function strengthLabel(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "#ef4444", width: "20%" };
  if (score === 2) return { label: "Fair", color: "#f97316", width: "40%" };
  if (score === 3) return { label: "Good", color: "#eab308", width: "60%" };
  if (score === 4) return { label: "Strong", color: "#22c55e", width: "80%" };
  return { label: "Very Strong", color: "#16a34a", width: "100%" };
}

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = strengthLabel(newPassword);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email address."); return; }
    setLoading(true);
    try {
      await apiJson("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const verifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) { setError("Enter the 6-digit OTP."); return; }
    setStep("reset");
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await apiJson("/auth/reset-password", { method: "POST", body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword }) });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      if ((err as Error).message?.includes("OTP")) setStep("otp");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
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
            Secure<br />Password<br />Recovery
          </h1>
          <p className="text-green-200 text-base leading-relaxed">
            A 6-digit OTP will be sent to your registered email. Use it to verify your identity and set a new password.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {[
              { icon: Mail, label: "Enter your email" },
              { icon: KeyRound, label: "Verify 6-digit OTP" },
              { icon: ShieldCheck, label: "Set new strong password" },
            ].map(({ icon: Icon, label }, i) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  (step === "email" && i === 0) || (step === "otp" && i === 1) || (step === "reset" && i === 2) || step === "done"
                    ? "bg-green-500 text-white" : "bg-green-700 text-green-300"
                }`}>{i + 1}</div>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-green-300" />
                  <span className="text-green-100 text-sm">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-green-400 text-xs">© {new Date().getFullYear()} ScriptHive Publication House</p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <Link to="/admin/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>

          {step === "done" ? (
            <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">Password Reset!</h2>
              <p className="text-sm text-slate-500 mb-6">Your password has been updated successfully. You can now sign in with your new password.</p>
              <button type="button" onClick={() => navigate("/admin/login")}
                className="w-full h-11 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm">
                Go to Login
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              {/* Step header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  {step === "email" && <><Mail className="w-5 h-5 text-green-600" /><h2 className="font-heading text-2xl font-bold text-slate-900">Forgot Password</h2></>}
                  {step === "otp"   && <><KeyRound className="w-5 h-5 text-green-600" /><h2 className="font-heading text-2xl font-bold text-slate-900">Enter OTP</h2></>}
                  {step === "reset" && <><ShieldCheck className="w-5 h-5 text-green-600" /><h2 className="font-heading text-2xl font-bold text-slate-900">New Password</h2></>}
                </div>
                <p className="text-sm text-slate-500">
                  {step === "email" && "Enter the email address registered with your admin account."}
                  {step === "otp"   && `A 6-digit OTP was sent to ${email}. Enter it below.`}
                  {step === "reset" && "Choose a strong password for your account."}
                </p>
              </div>

              {/* Progress bar */}
              <div className="flex gap-1.5 mb-6">
                {(["email","otp","reset"] as Step[]).map((s, i) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${
                    (step === "email" && i === 0) || (step === "otp" && i <= 1) || step === "reset" ? "bg-green-500" : "bg-slate-200"
                  }`} />
                ))}
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              {/* Step 1 — Email */}
              {step === "email" && (
                <form onSubmit={(e) => void sendOtp(e)} className="flex flex-col gap-4">
                  <label className="text-sm font-medium text-slate-700">
                    Email address
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@scripthive.org" autoFocus autoComplete="email"
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={loading} />
                  </label>
                  <button type="submit" disabled={loading}
                    className="h-11 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-60">
                    {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending OTP…</span> : "Send OTP"}
                  </button>
                </form>
              )}

              {/* Step 2 — OTP */}
              {step === "otp" && (
                <form onSubmit={(e) => void verifyOtp(e)} className="flex flex-col gap-4">
                  <label className="text-sm font-medium text-slate-700">
                    6-digit OTP
                    <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="_ _ _ _ _ _" autoFocus
                      className="mt-1.5 h-14 w-full rounded-lg border border-slate-200 px-4 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={loading} />
                  </label>
                  <button type="submit"
                    className="h-11 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm">
                    Verify OTP
                  </button>
                  <button type="button" onClick={() => { setOtp(""); setError(""); void sendOtp({ preventDefault: () => {} } as React.FormEvent); }}
                    className="text-xs text-green-700 hover:underline text-center">
                    Resend OTP
                  </button>
                </form>
              )}

              {/* Step 3 — New password */}
              {step === "reset" && (
                <form onSubmit={(e) => void resetPassword(e)} className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">New Password</label>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)} autoFocus
                        placeholder="Min 8 characters" autoComplete="new-password"
                        className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        disabled={loading} />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: strength.width, background: strength.color }} />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs" style={{ color: strength.color }}>{strength.label}</span>
                          <span className="text-xs text-slate-400">Use uppercase, numbers & symbols</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Confirm Password</label>
                    <div className="relative">
                      <input type={showConfirm ? "text" : "password"} value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password" autoComplete="new-password"
                        className={`h-11 w-full rounded-lg border px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          confirmPassword && newPassword !== confirmPassword ? "border-red-300 bg-red-50" : "border-slate-200"
                        }`}
                        disabled={loading} />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && (
                      <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                    )}
                  </div>

                  <ul className="text-xs text-slate-500 space-y-0.5 bg-slate-50 rounded-lg px-3 py-2.5">
                    {[
                      ["At least 8 characters", newPassword.length >= 8],
                      ["Uppercase letter (A-Z)", /[A-Z]/.test(newPassword)],
                      ["Number (0-9)", /[0-9]/.test(newPassword)],
                      ["Special character (!@#$...)", /[^A-Za-z0-9]/.test(newPassword)],
                    ].map(([label, ok]) => (
                      <li key={String(label)} className={`flex items-center gap-1.5 ${ok ? "text-green-600" : "text-slate-400"}`}>
                        <span>{ok ? "✓" : "○"}</span> {String(label)}
                      </li>
                    ))}
                  </ul>

                  <button type="submit" disabled={loading || newPassword !== confirmPassword || newPassword.length < 8}
                    className="h-11 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-60">
                    {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Resetting…</span> : "Reset Password"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
