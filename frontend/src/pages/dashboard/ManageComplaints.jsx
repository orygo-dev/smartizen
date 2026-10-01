import { toast } from "sonner";
import { MessageSquareWarning } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope, isSuperAdmin } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NEXT = { SUBMITTED: "ASSIGNED", ASSIGNED: "IN_PROGRESS", IN_PROGRESS: "RESOLVED" };

export default function ManageComplaints() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const params = isSuperAdmin(user) ? {} : { region_id: scope?.id };
  const canQuery = isSuperAdmin(user) || !!scope;
  const { data, loading, error, reload } = useApi(canQuery ? "/civic/complaints" : null, [scope?.id], { params });

  const update = async (c, status) => {
    try { await api.post(`/civic/complaints/${c.id}/update`, { status, note: `Status diperbarui ke ${status}` }); toast.success("Status diperbarui."); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Pengaduan" subtitle="Kelola dan tindak lanjuti pengaduan warga" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between"><span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-500/10">{c.category}</span><StatusChip status={c.status} /></div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{c.description}</p>
                <p className="mt-1 text-xs text-slate-400">Oleh {c.reporter_name || "Warga"} • {fmtDateTime(c.created_at)}</p>
                {NEXT[c.status] && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => update(c, NEXT[c.status])} data-testid={`complaint-advance-${c.id}`} className="rounded-full sz-gradient text-white">Proses: {NEXT[c.status]}</Button>
                    <Button size="sm" variant="outline" onClick={() => update(c, "REJECTED")} className="rounded-full border-rose-200 text-rose-600">Tolak</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <EmptyState icon={MessageSquareWarning} title="Belum ada pengaduan" description="Belum ada laporan pengaduan dari warga." />}
    </div>
  );
}
