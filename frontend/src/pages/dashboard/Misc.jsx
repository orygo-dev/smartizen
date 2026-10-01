import { Map } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";

export function Regions() {
  const { data, loading } = useApi("/regions", [], { params: { level: "RT" } });
  return (
    <div>
      <PageHeader title="Wilayah" subtitle="Daftar RT di platform Rakatin" />
      {loading ? <Loading /> : data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2"><Map className="h-4 w-4 text-sky-500" /><span className="font-medium text-slate-700 dark:text-slate-200">{r.name}</span></div>
              <StatusChip status={r.status} />
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Map} title="Belum ada wilayah RT" description="RT yang terdaftar akan muncul di sini." />}
    </div>
  );
}

export function AuditLog() {
  const { data, loading } = useApi("/dashboard/summary", []); // placeholder: real audit endpoint can be added
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Jejak aktivitas sensitif platform" />
      <EmptyState icon={Map} title="Log Audit Aman" description="Semua tindakan sensitif dicatat server-side. Tampilan audit lengkap tersedia pada fase berikutnya." />
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi platform & preferensi" />
      <EmptyState icon={Map} title="Pengaturan" description="Panel pengaturan platform akan dilengkapi pada iterasi berikutnya." />
    </div>
  );
}
