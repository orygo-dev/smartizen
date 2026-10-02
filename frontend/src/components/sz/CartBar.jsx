import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShoppingCart, Minus, Plus, Trash2, Loader2, PackageOpen, Store } from "lucide-react";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { rupiah } from "@/lib/labels";
import { useCart } from "@/lib/cart";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function CartLine({ i, setQty }) {
  return (
    <div className="flex items-center gap-3" data-testid={`cart-item-${i.product_id}`}>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        {i.image_url ? <img src={mediaUrl(i.image_url)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-300"><PackageOpen className="h-5 w-5" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{i.name}</p>
        <p className="text-xs text-slate-500">{rupiah(i.price)}</p>
      </div>
      <div className="flex items-center rounded-full border border-slate-200 dark:border-slate-700">
        <button onClick={() => setQty(i.product_id, i.qty - 1)} className="grid h-8 w-8 place-items-center" data-testid={`cart-minus-${i.product_id}`} aria-label="Kurangi">{i.qty === 1 ? <Trash2 className="h-3.5 w-3.5 text-rose-500" /> : <Minus className="h-3.5 w-3.5" />}</button>
        <span className="w-6 text-center text-sm font-bold" data-testid={`cart-qty-${i.product_id}`}>{i.qty}</span>
        <button onClick={() => setQty(i.product_id, i.qty + 1)} className="grid h-8 w-8 place-items-center" data-testid={`cart-plus-${i.product_id}`} aria-label="Tambah"><Plus className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function CartBar() {
  const navigate = useNavigate();
  const { cart, setQty, clear, count, total } = useCart();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!cart) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/marketplace/orders", { merchant_id: cart.merchant_id, items: cart.items.map((i) => ({ product_id: i.product_id, qty: i.qty })), note });
      toast.success("Pesanan terkirim ke penjual."); clear(); setNote(""); setOpen(false); navigate("/app/pesanan");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="cart-bar"
        className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-full sz-gradient px-5 py-3 text-white shadow-xl transition-transform active:scale-[0.98]">
        <span className="relative"><ShoppingCart className="h-5 w-5" /><span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-sky-700" data-testid="cart-count">{count}</span></span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{cart.merchant_name}</span>
        <span className="font-extrabold" data-testid="cart-bar-total">{rupiah(total)}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85vh] max-w-2xl flex-col rounded-t-2xl" data-testid="cart-sheet">
          <SheetHeader className="text-left">
            <SheetTitle>Keranjang</SheetTitle>
            <SheetDescription className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> {cart.merchant_name}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto py-3">{cart.items.map((i) => <CartLine key={i.product_id} i={i} setQty={setQty} />)}</div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Catatan untuk penjual (mis. waktu ambil, alamat antar)" className="rounded-xl" data-testid="cart-note-input" />
          <div className="flex items-center justify-between gap-3 pt-3">
            <div><p className="text-xs text-slate-400">Total ({count} barang)</p><p className="text-lg font-extrabold" data-testid="cart-total">{rupiah(total)}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clear} className="rounded-full" data-testid="cart-clear">Kosongkan</Button>
              <Button onClick={submit} disabled={busy} className="rounded-full sz-gradient text-white" data-testid="cart-submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Pesanan"}</Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Harga final dihitung penjual saat pesanan dikirim. Pembayaran langsung dengan penjual.</p>
        </SheetContent>
      </Sheet>
    </>
  );
}
