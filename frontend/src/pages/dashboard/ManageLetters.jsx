import { toast } from "sonner";
import { FileText, Check, X, Paperclip } from "lucide-react";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope, isSuperAdmin } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export default function ManageLetters() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const params = isSuperAdmin(user) ? {} : { region_id: scope?.id };
  const canQuery = isSuperAdmin(user) || !!scope;
  const { data, loading, error, reload } = useApi(canQuery ? "/civic/letters" : null, [scope?.id], { params });

  const act = async (l, action) => {
    try { await api.post(`/civic/letters/${l.id}/action`, { action, note: action === "REJECT" ? "Ditolak oleh pengurus." : "" }); toast.success(action === "APPROVE" ? "Surat disetujui." : "Surat ditolak."); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Surat" subtitle="Setujui pengajuan surat sesuai alur kerja" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((l) => {
              const pending = l.status === "PENDING_REVIEW";
              return (
                <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800 dark:text-slate-100">{l.letter_type_name}</p><p className="text-xs text-slate-400">{l.requester_name} • Tahap {Math.min(l.current_step + 1, l.workflow.length)}/{l.workflow.length} • {fmtDate(l.created_at)}</p></div>
                    <StatusChip status={l.status} />
                  </div>
                  {l.attachments?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {l.attachments.map((a, i) => (
                        <a key={i} href={mediaUrl(a.url)} target="_blank" rel="noreferrer" data-testid={`letter-attachment-link-${i}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800">
                          <Paperclip className="h-3 w-3" /> {a.name}
                        </a>
                      ))}
                    </div>
                  )}
                  {pending && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => act(l, "APPROVE")} data-testid={`letter-approve-${l.id}`} className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"><Check className="mr-1 h-3.5 w-3.5" /> Setujui</Button>
                      <Button size="sm" variant="outline" onClick={() => act(l, "REJECT")} className="rounded-full border-rose-200 text-rose-600"><X className="mr-1 h-3.5 w-3.5" /> Tolak</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={FileText} title="Belum ada pengajuan surat" description="Pengajuan surat dari warga akan muncul di sini." />}
    </div>
  );
}
