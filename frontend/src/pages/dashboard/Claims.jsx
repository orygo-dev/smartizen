import { toast } from "sonner";
import { Scale } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export default function Claims() {
  const { data, loading, error, reload } = useApi("/rt/claims", []);
  const act = async (c, action) => {
    try { await api.post(`/rt/claims/${c.id}/resolve`, { action }); toast.success("Klaim diproses."); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const open = (data || []).filter((c) => c.status === "CONFLICT");

  return (
    <div>
      <PageHeader title="Konflik Klaim RT" subtitle="Selesaikan klaim ganda atas RT yang sudah terverifikasi" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        open.length ? (
          <div className="space-y-3">
            {open.map((c) => (
              <div key={c.id} className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/5">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/10"><Scale className="h-5 w-5" /></div>
                  <div className="flex-1"><p className="font-semibold text-slate-800 dark:text-slate-100">Klaim oleh {c.official?.name}</p><p className="text-xs text-slate-400">{c.official?.position} • {fmtDate(c.created_at)}</p></div>
                  <StatusChip status={c.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => act(c, "KEEP_EXISTING")} variant="outline" className="rounded-full">Pertahankan Pengurus Lama</Button>
                  <Button size="sm" onClick={() => act(c, "REPLACE_OFFICIAL")} className="rounded-full sz-gradient text-white">Ganti Pengurus</Button>
                  <Button size="sm" onClick={() => act(c, "REQUEST_MORE_EVIDENCE")} variant="outline" className="rounded-full">Minta Bukti</Button>
                  <Button size="sm" onClick={() => act(c, "REJECT_CLAIM")} variant="outline" className="rounded-full border-rose-200 text-rose-600">Tolak Klaim</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Scale} title="Tidak ada konflik" description="Tidak ada klaim RT yang perlu diselesaikan saat ini." />}
    </div>
  );
}
