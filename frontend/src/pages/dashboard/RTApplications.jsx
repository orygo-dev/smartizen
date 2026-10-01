import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Check, X, FileText, Eye } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function RTApplications() {
  const { data, loading, error, reload } = useApi("/rt/applications", [], { params: { status: "PENDING_REVIEW" } });
  const [detail, setDetail] = useState(null);

  const act = async (app, verb) => {
    try {
      if (verb === "verify") await api.post(`/rt/applications/${app.id}/verify`);
      else await api.post(`/rt/applications/${app.id}/reject`, { note: "Dokumen tidak memenuhi syarat." });
      toast.success(verb === "verify" ? "RT diverifikasi & diaktifkan." : "Pengajuan ditolak.");
      setDetail(null); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Pengajuan RT" subtitle="Verifikasi pendaftaran RT oleh Admin Rakatin" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10"><BadgeCheck className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{a.rt_name} — {a.official?.name}</p>
                    <p className="text-xs text-slate-400">{a.official?.position} • {a.documents?.length || 0} dokumen • {fmtDate(a.created_at)}</p>
                  </div>
                  <StatusChip status={a.status} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDetail(a)} data-testid={`view-app-${a.id}`} className="rounded-full"><Eye className="mr-1 h-3.5 w-3.5" /> Detail</Button>
                  <Button size="sm" onClick={() => act(a, "verify")} data-testid={`verify-app-${a.id}`} className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"><Check className="mr-1 h-3.5 w-3.5" /> Verifikasi</Button>
                  <Button size="sm" variant="outline" onClick={() => act(a, "reject")} data-testid={`reject-app-${a.id}`} className="rounded-full border-rose-200 text-rose-600"><X className="mr-1 h-3.5 w-3.5" /> Tolak</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={BadgeCheck} title="Tidak ada pengajuan" description="Belum ada pengajuan RT yang menunggu verifikasi." />}

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detail Pengajuan RT</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {[["RT", detail.rt_name], ["Pengurus", detail.official?.name], ["Jabatan", detail.official?.position], ["Nomor HP", detail.official?.phone], ["Jumlah KK", detail.profile?.household_count], ["Alamat", detail.profile?.address]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800"><span className="text-slate-400">{k}</span><span className="font-medium">{v || "-"}</span></div>
              ))}
              <div>
                <p className="mb-1.5 text-slate-400">Dokumen Pendukung (privat)</p>
                {detail.documents?.map((d, i) => <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/40"><FileText className="h-4 w-4 text-sky-500" /> {d.name} <span className="ml-auto text-xs text-slate-400">{d.type}</span></div>)}
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => act(detail, "verify")} className="flex-1 rounded-full bg-emerald-500 text-white" data-testid="modal-confirm-button">Verifikasi RT</Button>
                <Button onClick={() => act(detail, "reject")} variant="outline" className="rounded-full border-rose-200 text-rose-600">Tolak</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
