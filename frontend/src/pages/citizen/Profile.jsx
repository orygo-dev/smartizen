import { useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, ChevronRight, MapPin, Settings, BadgeCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { roleLabel, isCitizenRole } from "@/lib/labels";
import { StatusChip } from "@/components/sz/StatusChip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: mem } = useApi("/residents/my-membership", []);
  const initials = (user?.full_name || "W").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hasAdmin = user?.roles?.some((r) => !isCitizenRole(r));
  const regionName = mem?.region_path?.map((r) => r.name).slice(-3).join(", ");

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl sz-gradient p-6 text-center text-white shadow-lg">
        <Avatar className="mx-auto h-20 w-20 border-4 border-white/30"><AvatarFallback className="bg-white/20 text-2xl font-bold text-white">{initials}</AvatarFallback></Avatar>
        <h1 className="mt-3 text-xl font-extrabold">{user?.full_name}</h1>
        <p className="text-sm text-white/80">@{user?.profile?.username}</p>
        <div className="mt-2 flex justify-center gap-2 text-sm">
          <span className="rounded-full bg-white/20 px-3 py-0.5 font-semibold">{roleLabel(user?.primary_role)}</span>
        </div>
      </div>

      {mem?.membership && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><MapPin className="h-4 w-4 text-sky-500" /> Wilayah Saya</span>
            <StatusChip status={mem.membership.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{regionName}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {hasAdmin && (
          <button onClick={() => navigate("/dashboard")} data-testid="goto-dashboard" className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
            <ShieldCheck className="h-5 w-5 text-emerald-500" /><span className="flex-1 font-medium text-slate-700 dark:text-slate-200">Dashboard Pengurus</span><ChevronRight className="h-4 w-4 text-slate-300" />
          </button>
        )}
        <button className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
          <BadgeCheck className="h-5 w-5 text-sky-500" /><span className="flex-1 font-medium text-slate-700 dark:text-slate-200">Verifikasi Identitas</span><ChevronRight className="h-4 w-4 text-slate-300" />
        </button>
        <button className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <Settings className="h-5 w-5 text-slate-400" /><span className="flex-1 font-medium text-slate-700 dark:text-slate-200">Pengaturan & Privasi</span><ChevronRight className="h-4 w-4 text-slate-300" />
        </button>
      </div>

      <Button onClick={logout} variant="outline" data-testid="citizen-logout-button" className="w-full rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"><LogOut className="mr-2 h-4 w-4" /> Keluar</Button>
    </div>
  );
}
