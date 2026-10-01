import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, Bell, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/sz/Logo";
import { ThemeToggle } from "@/components/sz/ThemeToggle";
import { navForRole } from "@/config/nav";
import { roleLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = user?.primary_role;
  const groups = navForRole(role);
  const initials = (user?.full_name || "SZ").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5"><Logo /></div>
      <div className="mx-4 mb-4 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 dark:border-sky-500/20 dark:bg-sky-500/10">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Peran Anda</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{roleLabel(role)}</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)}
                  data-testid={`nav-${it.to.split("/").pop() || "dashboard"}`}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "sz-gradient text-white shadow-md shadow-blue-500/25"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}>
                  <it.icon className="h-[18px] w-[18px]" />
                  {it.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white dark:bg-slate-900">
            <button className="absolute right-3 top-4" onClick={() => setOpen(false)} data-testid="sidebar-close">
              <X className="h-5 w-5 text-slate-400" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="sidebar-open">
            <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="hidden text-sm font-medium text-slate-400 lg:block">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <button onClick={() => navigate("/app/notifikasi")} className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="header-notifications">
              <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-2.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" data-testid="role-switcher-dropdown">
                <Avatar className="h-7 w-7"><AvatarFallback className="bg-sky-100 text-xs font-bold text-sky-700">{initials}</AvatarFallback></Avatar>
                <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-200 sm:block">{user?.full_name?.split(" ")[0]}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5 text-xs text-slate-400">{user?.email || user?.phone}</div>
                <DropdownMenuItem onClick={() => navigate("/app/beranda")} data-testid="menu-citizen-view">Tampilan Warga</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="logout-button" className="text-rose-600">
                  <LogOut className="mr-2 h-4 w-4" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
