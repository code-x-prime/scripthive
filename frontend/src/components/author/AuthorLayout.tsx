import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { FilePlus, LayoutDashboard, LogOut, BookOpen, ChevronRight, Package } from "lucide-react";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";

const NAV = [
  { to: "/author/dashboard", label: "My Submissions", icon: LayoutDashboard },
  { to: "/author/submit",    label: "Submit Paper",   icon: FilePlus },
  { to: "/author/addons",    label: "Add-On Services", icon: Package }
];

export function AuthorLayout() {
  const { author, logout } = useAuthorAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/author/login", { replace: true });
  };

  const initials = author?.name
    ? author.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "AU";

  return (
    <div className="flex min-h-screen bg-slate-50 print:min-h-0 print:bg-white">
      {/* Sidebar — sticky, does not scroll with page */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 h-screen overflow-y-auto print:hidden">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">ScriptHive</p>
            <p className="text-xs text-green-600 font-medium">Author Portal</p>
          </div>
        </div>

        {/* Author info */}
        <div className="mx-4 mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{author?.name}</p>
              <p className="truncate text-xs text-slate-500">{author?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-5 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm print:hidden">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BookOpen className="h-4 w-4 text-green-600" />
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-900">Author Portal</span>
          </div>
          {/* Mobile nav */}
          <nav className="flex lg:hidden items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium ${
                    isActive ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-50"
                  }`
                }>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold shrink-0">
                {initials}
              </div>
              <span className="hidden sm:block text-sm font-medium text-slate-700">{author?.name}</span>
            </div>
            <button type="button" onClick={() => void onLogout()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
