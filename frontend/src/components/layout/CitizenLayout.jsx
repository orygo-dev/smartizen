import { useEffect, useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, LayoutGrid, Store, Clapperboard, User, Bell, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/sz/Logo";
import { ThemeToggle } from "@/components/sz/ThemeToggle";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app/beranda", label: "Beranda", icon: Home },
  { to: "/app/layanan", label: "Layanan", icon: LayoutGrid },
  { to: "/app/marketplace", label: "Marketplace", icon: Store },
  { to: "/app/reels", label: "Reels", icon: Clapperboard },
  { to: "/app/profil", label: "Profil", icon: User },
];

export default function CitizenLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [chatUnread, setChatUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [ordersPending, setOrdersPending] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [c, n, o] = await Promise.all([
        api.get("/chat/unread-count"),
        api.get("/social/notifications/unread-count"),
        api.get("/marketplace/orders/pending-count").catch(() => ({ data: { pending: 0 } })),
      ]);
      setChatUnread(c.data?.unread || 0);
      setNotifUnread(n.data?.unread || 0);
      setOrdersPending(o.data?.pending || 0);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  // refresh promptly when navigating (e.g. after reading notifications/chat)
  useEffect(() => { refresh(); }, [location.pathname, refresh]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={() => navigate("/app/notifikasi")} className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="citizen-notifications">
            <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            {notifUnread > 0 && (
              <span data-testid="notif-badge" className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">{notifUnread > 9 ? "9+" : notifUnread}</span>
            )}
          </button>
          <button onClick={() => navigate("/app/chat")} className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="citizen-chat">
            <MessageCircle className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            {chatUnread > 0 && (
              <span data-testid="chat-badge" className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">{chatUnread > 9 ? "9+" : chatUnread}</span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-1.5">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} data-testid={`tab-${t.label.toLowerCase()}`}
              className={({ isActive }) => cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-400"
              )}>
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <t.icon className={cn("h-[22px] w-[22px]", isActive && "scale-110 transition-transform")} />
                    {t.to === "/app/marketplace" && ordersPending > 0 && (
                      <span data-testid="marketplace-order-badge" className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">{ordersPending > 9 ? "9+" : ordersPending}</span>
                    )}
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
