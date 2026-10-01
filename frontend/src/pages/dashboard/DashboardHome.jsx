import { useNavigate } from "react-router-dom";
import {
  Users, UserCheck, FileText, MessageSquareWarning, Building2, BadgeCheck,
  Scale, Wallet, Home, CalendarDays, Megaphone, Plus, Activity,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { StatCard } from "@/components/sz/StatCard";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { isSuperAdmin } from "@/lib/scope";
import { roleLabel, fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading } = useApi("/dashboard/summary", []);
  const { data: recent } = useApi("/dashboard/recent", []);
  const sa = isSuperAdmin(user);

  if (loading) return <div><PageHeader title="Dashboard" /><Loading rows={4} /></div>;
  const k = data?.kpis || {};

  return (
    <div>
      <PageHeader title={`Dashboard ${roleLabel(user?.primary_role)}`}
        subtitle="Ringkasan aktivitas wilayah Anda secara real-time" />

      {sa ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard testId="dashboard-kpi-total_users" icon={Users} label="Total Pengguna" value={k.total_users ?? 0} tone="sky" />
            <StatCard testId="dashboard-kpi-verified_residents" icon={UserCheck} label="Warga Terverifikasi" value={k.verified_residents ?? 0} tone="emerald" />
            <StatCard testId="dashboard-kpi-active_rt" icon={Building2} label="RT Aktif" value={k.active_rt ?? 0} hint={`${k.registered_rt ?? 0} terdaftar`} tone="teal" />
            <StatCard testId="dashboard-kpi-villages" icon={Home} label="Kelurahan/Desa" value={k.villages ?? 0} tone="cyan" />
            <StatCard testId="dashboard-kpi-pending_applications" icon={BadgeCheck} label="Pengajuan RT" value={k.pending_applications ?? 0} hint="menunggu" tone="amber" />
            <StatCard testId="dashboard-kpi-claim_conflicts" icon={Scale} label="Konflik Klaim" value={k.claim_conflicts ?? 0} tone="rose" />
            <StatCard testId="dashboard-kpi-complaints" icon={MessageSquareWarning} label="Pengaduan Aktif" value={k.pending_complaints ?? 0} tone="rose" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Tindakan Verifikasi</h3>
              <p className="mt-1 text-sm text-slate-500">Tinjau pengajuan RT dan konflik klaim yang masuk.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => navigate("/dashboard/rt-applications")} data-testid="goto-rt-apps" className="rounded-full sz-gradient text-white">Pengajuan RT ({k.pending_applications ?? 0})</Button>
                <Button onClick={() => navigate("/dashboard/claims")} variant="outline" className="rounded-full">Konflik ({k.claim_conflicts ?? 0})</Button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100"><Activity className="h-4 w-4 text-sky-500" /> Kesehatan Platform</h3>
              <p className="mt-1 text-sm text-slate-500">Semua sistem beroperasi normal.</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {["API", "Database", "Realtime", "Storage"].map((s) => <span key={s} className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-600 dark:bg-emerald-500/10">● {s}</span>)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard testId="dashboard-kpi-total_residents" icon={Users} label="Total Warga" value={k.total_residents ?? 0} tone="sky" />
            <StatCard testId="dashboard-kpi-verified_residents" icon={UserCheck} label="Terverifikasi" value={k.verified_residents ?? 0} tone="emerald" />
            <StatCard testId="dashboard-kpi-pending_verification" icon={BadgeCheck} label="Menunggu Verifikasi" value={k.pending_verification ?? 0} tone="amber" />
            <StatCard testId="dashboard-kpi-letters_pending" icon={FileText} label="Surat Pending" value={k.letters_pending ?? 0} tone="cyan" />
            <StatCard testId="dashboard-kpi-complaints_active" icon={MessageSquareWarning} label="Pengaduan Aktif" value={k.complaints_active ?? 0} tone="rose" />
            <StatCard testId="dashboard-kpi-dues" icon={Wallet} label="Program Iuran" value={k.dues_total ?? 0} tone="teal" />
            {data?.scope !== "REGION" || user?.primary_role !== "RT_HEAD" ? (
              <StatCard testId="dashboard-kpi-rt_count" icon={Building2} label="Jumlah RT" value={k.rt_count ?? 0} hint={`${k.active_rt ?? 0} aktif`} tone="violet" />
            ) : null}
          </div>

          {/* quick actions */}
          <div className="mt-6 flex flex-wrap gap-2">
            {user?.primary_role === "RT_HEAD" && [
              ["Verifikasi Warga", "/dashboard/pending", UserCheck],
              ["Buat Pengumuman", "/dashboard/announcements", Megaphone],
              ["Tambah Agenda", "/dashboard/agenda", CalendarDays],
              ["Buat Iuran", "/dashboard/dues", Wallet],
            ].map(([l, to, Icon]) => (
              <Button key={to} onClick={() => navigate(to)} variant="outline" className="rounded-full" data-testid={`quick-action-${to.split("/").pop()}`}>
                <Icon className="mr-1.5 h-4 w-4" /> {l}
              </Button>
            ))}
          </div>

          {/* recent sections */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 font-bold text-slate-800 dark:text-slate-100">Warga Terbaru</h3>
              {recent?.new_residents?.length ? recent.new_residents.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{m.name || "Warga"}</span><StatusChip status={m.status} />
                </div>
              )) : <p className="py-4 text-center text-sm text-slate-400">Belum ada warga terdaftar.</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 font-bold text-slate-800 dark:text-slate-100">Pengaduan Terbaru</h3>
              {recent?.complaints?.length ? recent.complaints.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{c.category}: {c.description?.slice(0, 30)}</span><StatusChip status={c.status} />
                </div>
              )) : <p className="py-4 text-center text-sm text-slate-400">Belum ada pengaduan.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
