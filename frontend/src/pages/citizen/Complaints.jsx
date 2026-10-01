import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareWarning, Plus, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATS = ["Kebersihan", "Keamanan", "Infrastruktur", "Fasilitas Umum", "Lingkungan", "Lainnya"];

export default function Complaints() {
  const { data, loading, error, reload } = useApi("/civic/complaints", [], { params: { mine: true } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "Kebersihan", description: "", location: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.description.trim()) return toast.error("Isi deskripsi pengaduan.");
    setSubmitting(true);
    try {
      await api.post("/civic/complaints", form);
      toast.success("Pengaduan terkirim."); setOpen(false); setForm({ category: "Kebersihan", description: "", location: "" }); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="Pengaduan" subtitle="Laporkan masalah lingkungan Anda"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="complaint-create-button" className="rounded-full sz-gradient font-semibold text-white"><Plus className="mr-1 h-4 w-4" /> Buat Pengaduan</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Buat Pengaduan</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Kategori</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger data-testid="complaint-category-select" className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Deskripsi</Label><Textarea data-testid="complaint-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 rounded-xl" /></div>
                <div><Label>Lokasi (opsional)</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 rounded-xl" /></div>
              </div>
              <DialogFooter><Button onClick={submit} disabled={submitting} data-testid="complaint-submit-button" className="rounded-full sz-gradient text-white">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between"><span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-500/10">{c.category}</span><StatusChip status={c.status} /></div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{c.description}</p>
                {c.location && <p className="mt-1 text-xs text-slate-400">📍 {c.location}</p>}
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                  {c.timeline?.map((t, i) => <div key={i} className="flex items-center gap-2 text-xs text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> <StatusChip status={t.status} /> {t.note} • {fmtDateTime(t.at)}</div>)}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={MessageSquareWarning} title="Belum ada pengaduan" description="Laporkan masalah lingkungan dan pantau penanganannya secara transparan." actionLabel="Buat Pengaduan" onAction={() => setOpen(true)} />}
    </div>
  );
}
