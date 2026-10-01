import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, Plus, Pencil, Trash2, ImagePlus, Loader2, PackageOpen, ArrowLeft } from "lucide-react";
import { api, formatApiError, uploadFile, mediaUrl } from "@/lib/api";
import { Loading, EmptyState } from "@/components/sz/States";
import { PageHeader } from "@/components/sz/PageHeader";
import { rupiah } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function ImagePicker({ value, onChange, label = "Gambar", square = true, testid }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return toast.error("Gambar terlalu besar (maks 15 MB).");
    setBusy(true);
    try { const up = await uploadFile(f); onChange(up.url); } catch { toast.error("Gagal mengunggah gambar."); } finally { setBusy(false); }
  };
  return (
    <div>
      <Label>{label}</Label>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} data-testid={testid} />
      <button type="button" onClick={() => ref.current?.click()} className={`mt-1 grid ${square ? "h-24 w-24" : "h-24 w-full"} place-items-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#0060F0] dark:border-slate-700`}>
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : value ? <img src={mediaUrl(value)} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
      </button>
    </div>
  );
}

export default function MyStore() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState(null);
  const [cats, setCats] = useState([]);
  // merchant form
  const [mForm, setMForm] = useState({ name: "", description: "", category: "Lainnya", phone: "", phone_public: false, address: "", hours: "", logo_url: null });
  const [savingM, setSavingM] = useState(false);
  // products
  const [products, setProducts] = useState([]);
  const [pOpen, setPOpen] = useState(false);
  const [pEdit, setPEdit] = useState(null);
  const [pForm, setPForm] = useState({ name: "", description: "", price: "", category: "Lainnya", image_url: null, available: true });
  const [savingP, setSavingP] = useState(false);
  const [delP, setDelP] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cat }, { data: me }] = await Promise.all([
        api.get("/marketplace/categories"), api.get("/marketplace/merchants/me"),
      ]);
      setCats(cat);
      setMerchant(me);
      if (me) {
        setMForm({ name: me.name, description: me.description || "", category: me.category, phone: me.phone || "", phone_public: !!me.phone_public, address: me.address || "", hours: me.hours || "", logo_url: me.logo_url || null });
        const { data: prods } = await api.get("/marketplace/products", { params: { merchant_id: me.id } });
        setProducts(prods);
      }
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const saveMerchant = async () => {
    if (!mForm.name.trim()) return toast.error("Nama usaha wajib diisi.");
    setSavingM(true);
    try {
      if (merchant) { await api.put("/marketplace/merchants/me", mForm); toast.success("Toko diperbarui."); }
      else { await api.post("/marketplace/merchants", mForm); toast.success("Toko berhasil dibuat!"); }
      loadAll();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSavingM(false); }
  };

  const openNewProduct = () => { setPEdit(null); setPForm({ name: "", description: "", price: "", category: cats[0] || "Lainnya", image_url: null, available: true }); setPOpen(true); };
  const openEditProduct = (p) => { setPEdit(p); setPForm({ name: p.name, description: p.description || "", price: String(p.price), category: p.category, image_url: p.image_url || null, available: p.available }); setPOpen(true); };

  const saveProduct = async () => {
    if (!pForm.name.trim()) return toast.error("Nama produk wajib diisi.");
    const payload = { ...pForm, price: Number(pForm.price) || 0 };
    setSavingP(true);
    try {
      if (pEdit) await api.put(`/marketplace/products/${pEdit.id}`, payload);
      else await api.post("/marketplace/products", payload);
      toast.success("Produk disimpan."); setPOpen(false); loadAll();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSavingP(false); }
  };

  const doDelete = async () => {
    const p = delP; setDelP(null);
    try { await api.delete(`/marketplace/products/${p.id}`); toast.success("Produk dihapus."); loadAll(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <button onClick={() => navigate("/app/marketplace")} className="mb-2 flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> Marketplace</button>
      <PageHeader title={merchant ? "Toko Saya" : "Buka Toko"} subtitle={merchant ? "Kelola profil usaha dan produk Anda" : "Daftarkan UMKM Anda di Rakatin"} />

      {/* Merchant form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-4">
          <ImagePicker value={mForm.logo_url} onChange={(u) => setMForm({ ...mForm, logo_url: u })} label="Logo" testid="store-logo-input" />
          <div className="flex-1 space-y-2">
            <div><Label>Nama Usaha</Label><Input value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} data-testid="store-name" className="mt-1 rounded-xl" /></div>
            <div><Label>Kategori</Label>
              <select value={mForm.category} onChange={(e) => setMForm({ ...mForm, category: e.target.value })} data-testid="store-category" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          <div><Label>Deskripsi</Label><Textarea value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} data-testid="store-desc" className="mt-1 rounded-xl" rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>No. HP/WA</Label><Input value={mForm.phone} onChange={(e) => setMForm({ ...mForm, phone: e.target.value })} data-testid="store-phone" className="mt-1 rounded-xl" /></div>
            <div><Label>Jam Buka</Label><Input value={mForm.hours} onChange={(e) => setMForm({ ...mForm, hours: e.target.value })} placeholder="08.00 - 21.00" className="mt-1 rounded-xl" /></div>
          </div>
          <div><Label>Alamat</Label><Input value={mForm.address} onChange={(e) => setMForm({ ...mForm, address: e.target.value })} className="mt-1 rounded-xl" /></div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tampilkan nomor ke publik</p><p className="text-xs text-slate-400">Warga bisa menelepon langsung</p></div>
            <Switch checked={mForm.phone_public} onCheckedChange={(v) => setMForm({ ...mForm, phone_public: v })} data-testid="store-phone-public" />
          </div>
        </div>
        <Button onClick={saveMerchant} disabled={savingM} data-testid="store-save" className="mt-3 w-full rounded-full sz-gradient text-white">
          {savingM ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Store className="mr-1.5 h-4 w-4" />} {merchant ? "Simpan Perubahan" : "Buka Toko"}
        </Button>
      </div>

      {/* Products */}
      {merchant && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Produk ({products.length})</h3>
            <Button size="sm" onClick={openNewProduct} data-testid="product-add" className="rounded-full sz-gradient text-white"><Plus className="mr-1 h-4 w-4" /> Tambah</Button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={PackageOpen} title="Belum ada produk" description="Tambahkan produk pertama Anda agar warga dapat menemukannya." actionLabel="Tambah Produk" onAction={openNewProduct} />
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid={`mystore-product-${p.id}`}>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    {p.image_url ? <img src={mediaUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-slate-300"><PackageOpen className="h-6 w-6" /></div>}
                  </div>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800 dark:text-slate-100">{p.name}</p><p className="text-sm font-bold text-[#0060F0]">{rupiah(p.price)}</p>{!p.available && <span className="text-xs text-slate-400">Tidak tersedia</span>}</div>
                  <button onClick={() => openEditProduct(p)} data-testid={`product-edit-${p.id}`} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDelP(p)} data-testid={`product-del-${p.id}`} className="rounded-full p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product dialog */}
      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{pEdit ? "Edit Produk" : "Tambah Produk"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <ImagePicker value={pForm.image_url} onChange={(u) => setPForm({ ...pForm, image_url: u })} label="Foto Produk" testid="product-image-input" />
            <div><Label>Nama Produk</Label><Input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} data-testid="product-name" className="mt-1 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Harga (Rp)</Label><Input type="number" value={pForm.price} onChange={(e) => setPForm({ ...pForm, price: e.target.value })} data-testid="product-price" className="mt-1 rounded-xl" /></div>
              <div><Label>Kategori</Label>
                <select value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Deskripsi</Label><Textarea value={pForm.description} onChange={(e) => setPForm({ ...pForm, description: e.target.value })} className="mt-1 rounded-xl" rows={2} /></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Produk tersedia</p>
              <Switch checked={pForm.available} onCheckedChange={(v) => setPForm({ ...pForm, available: v })} data-testid="product-available" />
            </div>
          </div>
          <DialogFooter><Button onClick={saveProduct} disabled={savingP} data-testid="product-save" className="w-full rounded-full sz-gradient text-white">{savingP ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delP} onOpenChange={(o) => !o && setDelP(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus produk?</AlertDialogTitle><AlertDialogDescription>Produk "{delP?.name}" akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete} data-testid="product-del-confirm" className="bg-rose-600 hover:bg-rose-700">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
