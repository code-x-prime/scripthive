import { Menu, Search } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export const TopBar = ({ onOpenNav }: { onOpenNav?: () => void }) => {
  const { admin } = useAuth();

  const initials = admin?.name
    ? admin.name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 xl:hidden"
          onClick={onOpenNav}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden w-72 sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Global Search..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-800">{admin?.name ?? "Admin"}</p>
          <p className="text-xs text-slate-400">
            {admin?.role.isSuper ? "Super Admin" : admin?.role.name ?? ""}
          </p>
        </div>
      </div>
    </header>
  );
};
