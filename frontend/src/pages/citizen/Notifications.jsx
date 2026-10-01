import { useEffect } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDateTime } from "@/lib/labels";

export default function Notifications() {
  const { data, loading, error, reload } = useApi("/social/notifications", []);
  useEffect(() => { api.post("/social/notifications/read-all").then(reload).catch(() => {}); /* eslint-disable-next-line */ }, []);
  return (
    <div>
      <PageHeader title="Notifikasi" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.items?.length ? (
          <div className="space-y-2.5">
            {data.items.map((n) => (
              <div key={n.id} className={`flex gap-3 rounded-2xl border p-4 shadow-sm ${n.read_at ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" : "border-sky-200 bg-sky-50/50 dark:border-sky-500/20 dark:bg-sky-500/5"}`}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-500/10"><Bell className="h-4 w-4" /></div>
                <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p><p className="text-sm text-slate-500">{n.body}</p><p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.created_at)}</p></div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Bell} title="Belum ada notifikasi" description="Notifikasi tentang surat, pengaduan, dan kabar warga akan muncul di sini." />}
    </div>
  );
}
