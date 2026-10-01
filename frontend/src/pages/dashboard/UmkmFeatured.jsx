import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Store, Loader2, X, PackageOpen } from "lucide-react";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { fmtDate } from "@/lib/labels";
import { PageHeader, Section } from "@/components/sz/PageHeader";
import { Loading, EmptyState, ErrorState } from "@/components/sz/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function MerchantRow({ m, busy, onFeature }) {
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800" data-testid={`umkm-manage-row-${m.id}`}>
      {m.logo_url || m.cover_url ? <img src={mediaUrl(m.logo_url || m.cover_url)} alt="" className="h-12 w-12 rounded-xl object-cover" />
        : <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-100 font-bold text-teal-700 dark:bg-teal-500/10">{m.name[0]}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{m.name}</p>
        <p className="truncate text-xs text-slate-400">{m.category} · {m.product_count} produk</p>
      </div>
      {m.featured ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Unggulan aktif</span> : (
        <div className="flex w-full gap-2 sm:w-auto">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Catatan promosi (opsional)" className="h-9 rounded-full sm:w-56" data-testid={`umkm-note-${m.id}`} />
          <Button onClick={() => onFeature(m.id, note)} disabled={busy} className="h-9 shrink-0 rounded-full sz-gradient text-white" data-testid={`umkm-feature-${m.id}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-1 h-4 w-4" /> Jadikan Unggulan</>}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function UmkmFeatured() {
  const [rtId, setRtId] = useState(null);
  const { data, loading, error, reload } = useApi("/umkm/manage", [rtId], { params: { rt_id: rtId || undefined } });
  const [busy, setBusy] = useState(false);

  const feature = async (merchant_id, note) => {
    setBusy(true);
    try { await api.post("/umkm/featured", { merchant_id, note }); toast.success("UMKM unggulan minggu ini diperbarui."); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    try { await api.delete(`/umkm/featured/${data.rt.id}`); toast.success("Unggulan dihapus."); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const current = data.merchants.find((m) => m.featured);

  return (
    <div className="space-y-5">
      <PageHeader title="UMKM Unggulan" subtitle={`Pilih satu UMKM untuk dipromosikan di beranda warga ${data.rt.name}${data.rt.rw_number ? ` / RW ${data.rt.rw_number}` : ""} minggu ini`} testId="umkm-featured-page"
        action={data.rts.length > 1 && (
          <select value={data.rt.id} onChange={(e) => setRtId(e.target.value)} data-testid="umkm-rt-select" className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            {data.rts.map((r) => <option key={r.id} value={r.id}>{r.name}{r.rw_number ? ` / RW ${r.rw_number}` : ""}</option>)}
          </select>
        )} />
      <Section title={`Minggu mulai ${fmtDate(data.week_start)}`}>
        {current ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10" data-testid="umkm-current-featured">
            <Sparkles className="h-6 w-6 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 dark:text-white">{current.name}</p>
              <p className="text-xs text-slate-500">{current.featured_note || "Tanpa catatan"} · berakhir {fmtDate(data.expires_at)}</p>
            </div>
            <Button variant="outline" onClick={clear} className="rounded-full" data-testid="umkm-clear-featured"><X className="mr-1 h-4 w-4" /> Hapus</Button>
          </div>
        ) : <p className="text-sm text-slate-500" data-testid="umkm-no-featured">Belum ada UMKM unggulan minggu ini.</p>}
      </Section>
      <Section title={`Toko di ${data.rt.name} (${data.merchants.length})`}>
        {data.merchants.length ? (
          <div className="space-y-2.5">{data.merchants.map((m) => <MerchantRow key={m.id} m={m} busy={busy} onFeature={feature} />)}</div>
        ) : <EmptyState icon={PackageOpen} title="Belum ada toko" description="Ajak warga membuka toko di menu Marketplace → Toko Saya." />}
      </Section>
      <p className="flex items-center gap-1.5 text-xs text-slate-400"><Store className="h-3.5 w-3.5" /> Hanya toko yang terdaftar di RT Anda yang dapat dipromosikan.</p>
    </div>
  );
}
