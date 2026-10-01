import { Building2, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatCard } from "@/components/sz/StatCard";

export default function SubRegions() {
  const { data, loading, error } = useApi("/dashboard/sub-regions", []);
  const totalRt = (data || []).reduce((s, r) => s + (r.rt_total || 0), 0);
  const activeRt = (data || []).reduce((s, r) => s + (r.active_rt || 0), 0);
  const residents = (data || []).reduce((s, r) => s + (r.residents || 0), 0);

  return (
    <div>
      <PageHeader title="Wilayah Bawahan" subtitle="Rekap adopsi Rakatin di wilayah Anda" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Total RT" value={totalRt} tone="sky" />
        <StatCard icon={Building2} label="RT Aktif" value={activeRt} tone="emerald" />
        <StatCard icon={Users} label="Total Warga" value={residents} tone="teal" />
      </div>
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
                <div className="mt-2 flex gap-4 text-sm text-slate-500">
                  <span>{r.active_rt}/{r.rt_total} RT aktif</span><span>{r.residents} warga</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full sz-gradient" style={{ width: `${r.rt_total ? (r.active_rt / r.rt_total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Building2} title="Belum ada wilayah bawahan" description="Wilayah di bawah administrasi Anda akan tampil di sini." />}
    </div>
  );
}
