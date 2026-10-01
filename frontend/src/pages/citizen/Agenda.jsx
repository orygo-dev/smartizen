import { CalendarDays, MapPin } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDateTime } from "@/lib/labels";

export default function Agenda() {
  const { data, loading, error } = useApi("/civic/agenda", []);
  return (
    <div>
      <PageHeader title="Agenda" subtitle="Kegiatan dan acara di lingkungan Anda" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((a) => (
              <div key={a.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><CalendarDays className="h-6 w-6" /></div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
                  {a.description && <p className="mt-0.5 text-sm text-slate-500">{a.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>🕒 {fmtDateTime(a.start)}</span>
                    {a.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {a.location}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={CalendarDays} title="Belum ada agenda" description="Belum ada kegiatan terjadwal dari RT atau Kelurahan Anda." />}
    </div>
  );
}
