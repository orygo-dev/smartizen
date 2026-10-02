import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Minus, Plus, Loader2, PackageOpen, ShoppingBag, Store, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { rupiah } from "@/lib/labels";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function QtyStepper({ qty, setQty }) {
  return (
    <div className="flex items-center rounded-full border border-slate-200 dark:border-slate-700">
      <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-9 w-9 place-items-center" data-testid="order-qty-minus" aria-label="Kurangi"><Minus className="h-4 w-4" /></button>
      <span className="w-8 text-center font-bold" data-testid="order-qty-value">{qty}</span>
      <button type="button" onClick={() => setQty(Math.min(99, qty + 1))} className="grid h-9 w-9 place-items-center" data-testid="order-qty-plus" aria-label="Tambah"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

export function ProductDialog({ product, merchantName, ownerId, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const p = product;
  const mine = (ownerId || p?.owner_user_id) === user?.id;
  const { cart, add } = useCart();
  const otherShop = cart && p && cart.merchant_id !== p.merchant_id;

  const addCart = () => {
    if (!add(p, merchantName || p.merchant_name, qty)) return toast.error("Keranjang penuh (maksimum 20 produk).");
    toast.success(`${p.name} ditambahkan ke keranjang.`); setQty(1); onClose();
  };

  const order = async () => {
    setBusy(true);
    try {
      await api.post("/marketplace/orders", { merchant_id: p.merchant_id, items: [{ product_id: p.id, qty }], note });
      toast.success("Pesanan terkirim ke penjual."); onClose(); navigate("/app/pesanan");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      {p && (
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-2xl" data-testid="product-dialog">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {p.image_url ? <img src={mediaUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-300"><PackageOpen className="h-12 w-12" /></div>}
          </div>
          <DialogHeader className="text-left">
            <DialogTitle data-testid="product-dialog-name">{p.name}</DialogTitle>
            <DialogDescription className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> {merchantName || p.merchant_name}</DialogDescription>
          </DialogHeader>
          <p className="text-xl font-extrabold text-[#0060F0]">{rupiah(p.price)}</p>
          {p.description && <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{p.description}</p>}
          {mine ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-500 dark:bg-slate-800" data-testid="product-own-note">Ini produk dari toko Anda.</p>
            : !p.available ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-500/10" data-testid="product-soldout">Produk sedang habis.</p> : (
            <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">Jumlah</span><QtyStepper qty={qty} setQty={setQty} /></div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Catatan untuk penjual (mis. waktu ambil, alamat antar)" className="rounded-xl" data-testid="order-note-input" />
              <div><p className="text-xs text-slate-400">Total</p><p className="text-lg font-extrabold" data-testid="order-total">{rupiah(p.price * qty)}</p></div>
              {otherShop && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" data-testid="cart-other-shop-warning">Keranjang Anda berisi produk dari {cart.merchant_name}. Menambahkan produk ini akan mengganti keranjang.</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={addCart} className="flex-1 rounded-full" data-testid="order-add-to-cart"><ShoppingCart className="mr-1.5 h-4 w-4" /> Keranjang</Button>
                <Button onClick={order} disabled={busy} className="flex-1 rounded-full sz-gradient text-white" data-testid="order-submit-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShoppingBag className="mr-1.5 h-4 w-4" /> Pesan Sekarang</>}</Button>
              </div>
              <p className="text-[11px] text-slate-400">Pembayaran dilakukan langsung dengan penjual setelah pesanan diterima.</p>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
