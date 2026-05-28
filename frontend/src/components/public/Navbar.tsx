import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Archive, ArrowRight, BookOpen, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { to: "/journals", label: "Journals", match: (p: string) => p === "/journals" },
  {
    to: "/journals",
    label: "Archives",
    match: (p: string) => p.includes("/archive")
  },
  { to: "/submit", label: "Submit Paper", match: (p: string) => p.startsWith("/submit") }
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const isActive = (match: (p: string) => boolean) => match(pathname);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/journals" className="flex flex-shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600 shadow-sm">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-gray-900">ScriptHive</p>
            <p className="-mt-0.5 text-[10px] text-gray-400">Publication House</p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors ${
                isActive(link.match)
                  ? "bg-green-50 font-medium text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {link.label === "Archives" ? <Archive className="h-3.5 w-3.5" /> : null}
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/author/login"
            className="hidden rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 md:inline-flex"
          >
            Author login
          </Link>
          <Link
            to="/submit"
            className="hidden items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 md:flex"
          >
            Submit Paper <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            className="p-1 text-gray-500 hover:text-gray-700 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-1 border-t border-gray-100 bg-white px-6 py-3 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm ${
                isActive(link.match) ? "bg-green-50 font-medium text-green-700" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/author/login"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Author login
          </Link>
          <Link
            to="/submit"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-lg bg-green-600 py-2.5 text-center text-sm font-medium text-white"
          >
            Submit Paper
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
