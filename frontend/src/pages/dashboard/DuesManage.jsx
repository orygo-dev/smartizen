import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Plus, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { rupiah, fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DuesManage() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, reload } = useApi(scope ? "/civic/dues" : null, [scope?.id], { params: { region_id: scope?.id } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", period: "monthly", due_date: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title || !form.amount) return toast.error("Lengkapi judul dan nominal.");
    setSaving(true);
    try {
      await api.post("/civic/dues", { region_id: scope.id, title: form.title, amount: parseInt(form.amount), period: form.period, due_date: form.due_date || null });
      toast.success("Iuran dibuat."); setOpen(false); setForm({ title: "", amount: "", period: "monthly", due_date: "" }); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Iuran" subtitle="Kelola program iuran warga di wilayah Anda"
        action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button data-testid="dues-create-button" className="rounded-full sz-gradient text-white"><Plus className="mr-1 h-4 w-4" /> Buat Iuran</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Buat Program Iuran</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Judul</Label><Input data-testid="dues-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. Iuran Keamanan" className="mt-1 rounded-xl" /></div>
              <div><Label>Nominal (Rp)</Label><Input data-testid="dues-amount-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Periode</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Bulanan</SelectItem><SelectItem value="one_time">Sekali Bayar</SelectItem><SelectItem value="activity">Kegiatan</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Jatuh Tempo (opsional)</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1 rounded-xl" /></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={saving} className="rounded-full sz-gradient text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}</Button></DialogFooter>
          </DialogContent></Dialog>} />
      {loading ? <Loading /> : data?.length ? (
        <div className="space-y-3">{data.map((d) => (
          <div key={d.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Wallet className="h-5 w-5" /></div>
            <div className="flex-1"><p className="font-semibold text-slate-800 dark:text-slate-100">{d.title}</p><p className="text-sm text-slate-500">{rupiah(d.amount)} • {d.period === "monthly" ? "Bulanan" : d.period === "one_time" ? "Sekali" : "Kegiatan"}{d.due_date && ` • ${fmtDate(d.due_date)}`}</p></div>
          </div>))}</div>
      ) : <EmptyState icon={Wallet} title="Belum ada program iuran" description="Buat program iuran untuk warga di wilayah Anda." actionLabel="Buat Iuran" onAction={() => setOpen(true)} />}
    </div>
  );
}
