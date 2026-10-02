import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Store, Search, MessageCircle, Phone, Bookmark, BookmarkCheck, ArrowLeft, Clock, MapPin, Flag, Loader2, Store as StoreIcon, PackageOpen } from "lucide-react";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { rupiah } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SCOPES = [
  { v: "rt", label: "RT Saya" },
  { v: "village", label: "Kelurahan" },
  { v: "regency", label: "Kota/Kab" },
  { v: "all", label: "Semua" },
];

function ProductCard({ p, onSave, onOpenMerchant }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid={`product-${p.id}`}>
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800">
        {p.image_url ? <img src={mediaUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" />
          : <div className="grid h-full w-full place-items-center text-slate-300"><PackageOpen className="h-10 w-10" /></div>}
        <button onClick={() => onSave(p)} data-testid={`product-save-${p.id}`} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-600 shadow dark:bg-slate-900/90">
          {p.saved ? <BookmarkCheck className="h-4 w-4 text-[#0060F0]" /> : <Bookmark className="h-4 w-4" />}
        </button>
        {!p.available && <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white">Habis</span>}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
        <p className="mt-0.5 font-bold text-[#0060F0]">{rupiah(p.price)}</p>
        <button onClick={() => onOpenMerchant(p.merchant_id)} className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <StoreIcon className="h-3 w-3" /> <span className="truncate">{p.merchant_name}</span>
        </button>
      </div>
    </div>
  );
}

function MerchantDetail({ mid, onBack }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get(`/marketplace/merchants/${mid}`); setM(data); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, [mid]);
  useEffect(() => { load(); }, [load]);

  const chatSeller = async () => {
    try {
      const { data } = await api.post("/chat/conversations", { peer_user_id: m.owner_user_id });
      navigate("/app/chat", { state: { open: { id: data.id, peer: data.peer } } });
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (loading) return <Loading />;
  if (!m) return null;

  return (
    <div>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-slate-500" data-testid="merchant-back"><ArrowLeft className="h-4 w-4" /> Kembali</button>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Avatar className="h-16 w-16 rounded-2xl">
            {m.logo_url ? <img src={mediaUrl(m.logo_url)} alt={m.name} className="h-full w-full rounded-2xl object-cover" />
              : <AvatarFallback className="rounded-2xl bg-blue-100 text-xl font-bold text-[#0060F0]">{m.name[0]}</AvatarFallback>}
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">{m.name}</h2>
            <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#0060F0] dark:bg-blue-500/10">{m.category}</span>
          </div>
        </div>
        {m.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{m.description}</p>}
        <div className="mt-3 space-y-1.5 text-sm text-slate-500">
          {m.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /> {m.address}</p>}
          {m.hours && <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" /> {m.hours}</p>}
        </div>
        {!m.is_owner && (
          <div className="mt-4 flex gap-2">
            <Button onClick={chatSeller} data-testid="merchant-chat" className="flex-1 rounded-full sz-gradient text-white"><MessageCircle className="mr-1.5 h-4 w-4" /> Chat Penjual</Button>
            {m.phone_public && m.phone && <a href={`tel:${m.phone}`} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-[#0060F0] dark:border-slate-700"><Phone className="h-4 w-4" /></a>}
          </div>
        )}
      </div>

      <h3 className="mb-2 mt-5 font-bold text-slate-800 dark:text-slate-100">Produk ({m.products?.length || 0})</h3>
      {m.products?.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {m.products.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800">
                {p.image_url ? <img src={mediaUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-slate-300"><PackageOpen className="h-8 w-8" /></div>}
              </div>
              <div className="p-2.5"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p><p className="font-bold text-[#0060F0]">{rupiah(p.price)}</p></div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={PackageOpen} title="Belum ada produk" description="Toko ini belum menambahkan produk." />}
    </div>
  );
}

export default function Marketplace() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("produk");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Semua");
  const [scope, setScope] = useState("regency");
  const [cats, setCats] = useState(["Semua"]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const selected = params.get("toko");
  const setSelected = (id) => setParams(id ? { toko: id } : {});

  useEffect(() => { api.get("/marketplace/categories").then(({ data }) => setCats(["Semua", ...data])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = tab === "produk" ? "/marketplace/products" : "/marketplace/merchants";
      const { data } = await api.get(path, { params: { q: q || undefined, category: category === "Semua" ? undefined : category, scope } });
      setItems(data);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [tab, q, category, scope]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const toggleSave = async (p) => {
    try { const { data } = await api.post(`/marketplace/products/${p.id}/save`); setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, saved: data.saved } : x)); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (selected) return <div><MerchantDetail mid={selected} onBack={() => setSelected(null)} /></div>;

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="UMKM dan produk lokal di sekitar Anda"
        action={<Button onClick={() => navigate("/app/toko")} variant="outline" data-testid="my-store-button" className="rounded-full"><Store className="mr-1.5 h-4 w-4" /> Toko Saya</Button>} />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk atau toko..." data-testid="marketplace-search" className="rounded-full pl-9" />
        </div>
        <select value={scope} onChange={(e) => setScope(e.target.value)} data-testid="marketplace-scope" className="rounded-full border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          {SCOPES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </div>

      <div className="mb-3 flex gap-2">
        {["produk", "toko"].map((t) => (
          <button key={t} onClick={() => setTab(t)} data-testid={`marketplace-tab-${t}`}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold capitalize", tab === t ? "sz-gradient text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>
            {t === "produk" ? "Produk" : "Toko"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button key={c} onClick={() => setCategory(c)} data-testid={`marketplace-cat-${c}`}
            className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", category === c ? "bg-[#0060F0] text-white" : "border border-slate-200 text-slate-500 dark:border-slate-700")}>
            {c}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon={Store} title="Belum ada yang ditampilkan" description="Belum ada UMKM atau produk pada cakupan ini. Coba ubah cakupan wilayah, atau jadilah yang pertama membuka toko." actionLabel="Buka Toko Saya" onAction={() => navigate("/app/toko")} />
      ) : tab === "produk" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((p) => <ProductCard key={p.id} p={p} onSave={toggleSave} onOpenMerchant={setSelected} />)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((m) => (
            <button key={m.id} onClick={() => setSelected(m.id)} data-testid={`merchant-${m.id}`}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <Avatar className="h-12 w-12 rounded-xl">
                {m.logo_url ? <img src={mediaUrl(m.logo_url)} alt={m.name} className="h-full w-full rounded-xl object-cover" /> : <AvatarFallback className="rounded-xl bg-blue-100 font-bold text-[#0060F0]">{m.name[0]}</AvatarFallback>}
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{m.name}</p>
                <p className="truncate text-xs text-slate-400">{m.category} · {m.product_count} produk</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
