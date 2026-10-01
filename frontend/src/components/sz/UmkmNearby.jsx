import { useNavigate } from "react-router-dom";
import { Store, Sparkles, ChevronRight, PackageOpen } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { mediaUrl } from "@/lib/api";

function Thumb({ m, className }) {
  const src = m.cover_url || m.logo_url;
  return src ? <img src={mediaUrl(src)} alt={m.name} className={`object-cover ${className}`} />
    : <div className={`grid place-items-center bg-gradient-to-br from-teal-100 to-sky-100 text-2xl font-extrabold text-teal-700 dark:from-teal-500/10 dark:to-sky-500/10 ${className}`}>{m.name[0]}</div>;
}

function FeaturedCard({ m, onOpen }) {
  return (
    <button onClick={() => onOpen(m.id)} data-testid={`umkm-featured-${m.id}`}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-teal-50 p-3 text-left shadow-sm transition-transform active:scale-[0.99] dark:border-amber-500/40 dark:from-amber-500/10 dark:via-slate-900 dark:to-teal-500/10">
      <Thumb m={m} className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950"><Sparkles className="h-3 w-3" /> Unggulan Minggu Ini</span>
        <p className="mt-1 truncate font-bold text-slate-900 dark:text-white">{m.name}</p>
        <p className="line-clamp-2 text-xs text-slate-500">{m.featured_note || m.description || m.category}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
    </button>
  );
}

function NearbyCard({ m, onOpen }) {
  return (
    <button onClick={() => onOpen(m.id)} data-testid={`umkm-card-${m.id}`}
      className="w-36 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-transform active:scale-95 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative"><Thumb m={m} className="h-24 w-full" />
        {m.is_new && <span className="absolute left-2 top-2 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">Baru</span>}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{m.name}</p>
        <p className="truncate text-[11px] text-slate-400">{m.category} · {m.product_count} produk</p>
      </div>
    </button>
  );
}

export function UmkmNearby() {
  const navigate = useNavigate();
  const { data, loading } = useApi("/umkm/nearby", []);
  const open = (id) => navigate(`/app/marketplace?toko=${id}`);
  const empty = !loading && data && !data.featured.length && !data.nearby.length;

  return (
    <section data-testid="umkm-nearby">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><Store className="h-4 w-4 text-teal-600" /> UMKM Sekitar</h2>
        <button onClick={() => navigate("/app/marketplace")} className="text-xs font-semibold text-sky-600" data-testid="umkm-see-all">Lihat semua</button>
      </div>
      {loading ? <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" /> : empty ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center dark:border-slate-800" data-testid="umkm-nearby-empty">
          <PackageOpen className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-1 text-sm text-slate-500">{data.has_region ? "Belum ada UMKM di kelurahan Anda." : "Bergabung dengan RT untuk melihat UMKM di sekitar Anda."}</p>
          <button onClick={() => navigate("/app/toko")} className="mt-2 text-xs font-semibold text-teal-600" data-testid="umkm-open-store">Buka toko Anda →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.featured.map((m) => <FeaturedCard key={m.id} m={m} onOpen={open} />)}
          {data.nearby.length > 0 && <div className="flex gap-3 overflow-x-auto pb-1 sz-scroll-x">{data.nearby.map((m) => <NearbyCard key={m.id} m={m} onOpen={open} />)}</div>}
        </div>
      )}
    </section>
  );
}
