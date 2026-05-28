import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { TopBar } from "./TopBar";

export const AdminLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="hidden xl:flex xl:h-screen xl:sticky xl:top-0">
        <AdminSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-slate-200 bg-white px-2 py-2 xl:hidden">
        <button
          type="button"
          className="flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 text-xs text-slate-700"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
          Menu
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-lg">
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
