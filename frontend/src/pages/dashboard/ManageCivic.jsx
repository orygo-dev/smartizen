import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Plus, CalendarDays, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDateTime, fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export function ManageAnnouncements() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, reload } = useApi(scope ? "/civic/announcements" : null, [scope?.id], { params: { region_id: scope?.id } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/civic/announcements", { region_id: scope.id, title: form.title, body: form.body });
      toast.success("Pengumuman dipublikasikan."); setOpen(false); setForm({ title: "", body: "" }); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Pengumuman" subtitle="Buat pengumuman untuk warga di wilayah Anda"
        action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button data-testid="announcement-create-button" className="rounded-full sz-gradient text-white"><Plus className="mr-1 h-4 w-4" /> Buat</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Buat Pengumuman</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Judul</Label><Input data-testid="announcement-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Isi</Label><Textarea data-testid="announcement-body-input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="mt-1 rounded-xl" /></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={saving || !form.title} data-testid="announcement-submit-button" className="rounded-full sz-gradient text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publikasikan"}</Button></DialogFooter>
          </DialogContent></Dialog>} />
      {loading ? <Loading /> : data?.length ? (
        <div className="space-y-3">{data.map((a) => (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{a.title}</p><p className="mt-1 text-sm text-slate-500">{a.body}</p><p className="mt-2 text-xs text-slate-400">{fmtDateTime(a.created_at)}</p>
          </div>))}</div>
      ) : <EmptyState icon={Megaphone} title="Belum ada pengumuman" description="Sampaikan informasi penting kepada warga Anda." actionLabel="Buat Pengumuman" onAction={() => setOpen(true)} />}
    </div>
  );
}

export function ManageAgenda() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, reload } = useApi(scope ? "/civic/agenda" : null, [scope?.id], { params: { region_id: scope?.id } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", start: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.start) return toast.error("Isi tanggal mulai.");
    setSaving(true);
    try {
      await api.post("/civic/agenda", { region_id: scope.id, ...form, start: new Date(form.start).toISOString() });
      toast.success("Agenda dibuat."); setOpen(false); setForm({ title: "", description: "", location: "", start: "" }); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Kelola kegiatan dan acara di wilayah Anda"
        action={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button data-testid="agenda-create-button" className="rounded-full sz-gradient text-white"><Plus className="mr-1 h-4 w-4" /> Tambah</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Tambah Agenda</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Judul</Label><Input data-testid="agenda-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Lokasi</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Waktu Mulai</Label><Input type="datetime-local" data-testid="agenda-start-input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="mt-1 rounded-xl" /></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={saving} className="rounded-full sz-gradient text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}</Button></DialogFooter>
          </DialogContent></Dialog>} />
      {loading ? <Loading /> : data?.length ? (
        <div className="space-y-3">{data.map((a) => (
          <div key={a.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><CalendarDays className="h-6 w-6" /></div>
            <div><p className="font-semibold text-slate-800 dark:text-slate-100">{a.title}</p><p className="text-sm text-slate-500">{a.description}</p><p className="mt-1 text-xs text-slate-400">🕒 {fmtDateTime(a.start)} {a.location && `• 📍 ${a.location}`}</p></div>
          </div>))}</div>
      ) : <EmptyState icon={CalendarDays} title="Belum ada agenda" description="Jadwalkan kegiatan lingkungan untuk warga Anda." actionLabel="Tambah Agenda" onAction={() => setOpen(true)} />}
    </div>
  );
}
