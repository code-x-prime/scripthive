import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BookMarked,
  CheckCircle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  CheckSquare,
  FileText,
  Globe,
  Hash,
  LayoutDashboard,
  LogOut,
  Rocket,
  Settings,
  Tag,
  Upload,
  Users,
  Wrench,
  XCircle,
  MessageSquare,
  Image
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  perm: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: "Dashboard",
    items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard", perm: "dashboard" }]
  },
  {
    section: "Journals",
    items: [{ label: "Manage Journals", icon: BookOpen, to: "/admin/journals", perm: "journals_manage" }]
  },
  {
    section: "Submissions",
    items: [
      { label: "New", icon: FileText, to: "/admin/submissions/new", perm: "submissions_new" },
      { label: "Under Review", icon: Clock, to: "/admin/submissions/under-review", perm: "submissions_under_review" },
      { label: "Accepted", icon: CheckCircle, to: "/admin/submissions/accepted", perm: "submissions_accepted" },
      { label: "Rejected", icon: XCircle, to: "/admin/submissions/rejected", perm: "submissions_rejected" }
    ]
  },
  {
    section: "Payments",
    items: [
      { label: "Pending", icon: CreditCard, to: "/admin/payments/pending", perm: "payments_pending" },
      { label: "Completed", icon: CheckSquare, to: "/admin/payments/completed", perm: "payments_completed" }
    ]
  },
  {
    section: "Production",
    items: [
      { label: "Ready for Preparation", icon: Wrench,      to: "/admin/production/preparation",   perm: "production_preparation"    },
      { label: "Ready for Upload",      icon: Upload,      to: "/admin/production/upload",         perm: "production_upload"         },
      { label: "Ready to Published",    icon: CheckCheck,  to: "/admin/production/ready-published",perm: "production_ready_published"},
      { label: "Volumes & Issues",      icon: BookMarked,  to: "/admin/production/volumes",        perm: "production_publish"        },
      { label: "Publish Article",       icon: Rocket,      to: "/admin/production/publish",        perm: "production_publish"        }
    ]
  },
  {
    section: "DOI Management",
    items: [
      { label: "Pending DOI", icon: Hash, to: "/admin/doi/pending", perm: "doi_pending" },
      { label: "Minted DOI", icon: Tag, to: "/admin/doi/minted", perm: "doi_minted" }
    ]
  },
  {
    section: "Contact",
    items: [{ label: "Contact Queries", icon: MessageSquare, to: "/admin/contact-queries", perm: "submissions:read" }]
  },
  {
    section: "Reports",
    items: [{ label: "Reports", icon: BarChart3, to: "/admin/reports", perm: "reports" }]
  },
];

export const AdminSidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const { canAccessPage, isSuperAdmin } = usePermissions();

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const w = collapsed ? "w-16" : "w-60";

  return (
    <aside className={`${w} flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200`}>
      <div className="flex min-h-[64px] items-center justify-between border-b border-slate-200 px-4 py-4">
        {!collapsed && (
          <div>
            <div className="font-heading text-lg font-bold leading-tight text-green-700">ScriptHive</div>
            <div className="text-xs font-medium text-slate-400">Admin Panel</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV.map(({ section, items }) => {
          const visible = items.filter((i) => canAccessPage(i.perm as Parameters<typeof canAccessPage>[0]));
          if (visible.length === 0) return null;
          return (
            <div key={section} className="mb-1">
              {!collapsed && (
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {section}
                </p>
              )}
              {visible.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  onClick={() => onNavigate?.()}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                    isActive(item.to)
                      ? "border-l-2 border-green-600 bg-green-50 pl-[9px] text-green-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <item.icon size={16} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          );
        })}

        {isSuperAdmin() && (
          <div className="mb-1">
            {!collapsed && (
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                System
              </p>
            )}
            {[
              { label: "Roles", icon: Users, to: "/admin/system/roles" },
              { label: "Users", icon: Users, to: "/admin/system/users" },
              { label: "Media Library", icon: Image, to: "/admin/media" },
              { label: "Settings", icon: Settings, to: "/admin/system/settings" }
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                onClick={() => onNavigate?.()}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                  isActive(item.to)
                    ? "border-l-2 border-green-600 bg-green-50 pl-[9px] text-green-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <item.icon size={16} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="space-y-1 border-t border-slate-200 p-2">
        <a
          href="https://scripthive.org"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Main Website" : undefined}
        >
          <Globe size={16} />
          {!collapsed && <span>Main Website</span>}
        </a>
        {!collapsed && (
          <div className="px-2.5 text-xs text-slate-500">
            <p className="font-medium text-slate-800">{admin?.name}</p>
            <p className="uppercase">{admin?.role.name}</p>
          </div>
        )}
        <button
          type="button"
          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Logout" : undefined}
          onClick={() => {
            onNavigate?.();
            void (async () => {
              await logout();
              navigate("/admin/login", { replace: true });
            })();
          }}
        >
          <LogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
