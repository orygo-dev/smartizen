import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MessageCircle, Receipt, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { rupiah, fmtDateTime } from "@/lib/labels";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SELLER_ACTIONS = { PENDING: [["ACCEPTED", "Terima"], ["REJECTED", "Tolak"]], ACCEPTED: [["COMPLETED", "Tandai Selesai"], ["REJECTED", "Tolak"]] };
const BUYER_ACTIONS = { PENDING: [["CANCELLED", "Batalkan"]] };

function OrderCard({ o, seller, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const actions = (seller ? SELLER_ACTIONS : BUYER_ACTIONS)[o.status] || [];

  const move = async (status) => {
    setBusy(status);
    try { await api.post(`/marketplace/orders/${o.id}/status`, { status }); toast.success("Status pesanan diperbarui."); onChanged(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(null); }
  };
  const chat = async () => {
    try {
      const { data } = await api.post("/chat/conversations", { peer_user_id: seller ? o.buyer_id : o.seller_id });
      navigate("/app/chat", { state: { open: { id: data.id, peer: data.peer } } });
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid={`order-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-800 dark:text-slate-100">{seller ? o.buyer_name : o.merchant_name}</p>
          <p className="text-xs text-slate-400">{fmtDateTime(o.created_at)}</p>
        </div>
        <StatusChip status={o.status} />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {o.items.map((i) => <li key={i.product_id} className="flex justify-between gap-2"><span className="truncate text-slate-600 dark:text-slate-300">{i.qty}× {i.name}</span><span className="shrink-0 text-slate-500">{rupiah(i.subtotal)}</span></li>)}
      </ul>
      {o.note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800">Catatan: {o.note}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="mr-auto font-extrabold text-[#0060F0]" data-testid={`order-total-${o.id}`}>{rupiah(o.total)}</p>
        <Button variant="outline" size="sm" onClick={chat} className="rounded-full" data-testid={`order-chat-${o.id}`}><MessageCircle className="mr-1 h-4 w-4" /> Chat</Button>
        {actions.map(([s, lbl]) => (
          <Button key={s} size="sm" onClick={() => move(s)} disabled={!!busy} data-testid={`order-action-${s.toLowerCase()}-${o.id}`}
            className={cn("rounded-full", s === "REJECTED" || s === "CANCELLED" ? "bg-rose-500 text-white hover:bg-rose-600" : "sz-gradient text-white")}>
            {busy === s ? <Loader2 className="h-4 w-4 animate-spin" /> : lbl}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "masuk" ? "masuk" : "saya";
  const seller = tab === "masuk";
  const { data, loading, reload } = useApi("/marketplace/orders", [tab], { params: { role: seller ? "seller" : "buyer" } });

  return (
    <div>
      <PageHeader title="Pesanan" subtitle="Pesanan UMKM antar warga" testId="orders-page" />
      <div className="mb-4 flex gap-2">
        {[["saya", "Pesanan Saya"], ["masuk", "Pesanan Masuk"]].map(([v, l]) => (
          <button key={v} onClick={() => setParams(v === "masuk" ? { tab: "masuk" } : {})} data-testid={`orders-tab-${v}`}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tab === v ? "sz-gradient text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>{l}</button>
        ))}
      </div>
      {loading ? <Loading /> : !data?.length ? (
        <EmptyState icon={Receipt} testId="orders-empty" title={seller ? "Belum ada pesanan masuk" : "Belum ada pesanan"}
          description={seller ? "Pesanan dari warga untuk toko Anda akan muncul di sini." : "Pesan produk UMKM tetangga langsung dari halaman produk di Marketplace."} />
      ) : <div className="space-y-3">{data.map((o) => <OrderCard key={o.id} o={o} seller={seller} onChanged={reload} />)}</div>}
    </div>
  );
}
