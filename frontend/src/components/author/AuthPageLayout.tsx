import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthPageLayout({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ background: "#f1f5f9" }}>
      {/* Left panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between p-12"
        style={{ background: "linear-gradient(160deg,#0f172a 0%,#1e3a8a 100%)" }}>
        <div>
          <Link to="/author/login" className="flex items-center gap-3 mb-16 no-underline">
            <img src="/logo.png" alt="ScriptHive" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">ScriptHive</p>
              <p className="text-xs font-semibold" style={{ color: "#93c5fd", letterSpacing: "0.08em" }}>AUTHOR PORTAL</p>
            </div>
          </Link>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Publish your<br />research globally
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
            Submit manuscripts, track peer review, access publication services — all in one place.
          </p>
          <div className="mt-10 space-y-4">
            {["Double-blind peer review", "ISSN-supported journals", "Fast review in 7–15 days"].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(37,99,235,0.4)" }}>
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                    <path d="M2 6l3 3 5-5" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm font-medium" style={{ color: "#cbd5e1" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: "#475569" }}>© 2026 ScriptHive Publication. All rights reserved.</p>
      </div>

      {/* Right panel */}
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

          <h1 className="text-2xl font-black text-slate-900 mb-1">{title}</h1>
          <p className="text-sm mb-8" style={{ color: "#64748b" }}>{subtitle}</p>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
