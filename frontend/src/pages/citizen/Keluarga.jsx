import { useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Trash2, Loader2, IdCard } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RELATIONS = ["Kepala Keluarga", "Istri", "Suami", "Anak", "Orang Tua", "Famili Lain", "Lainnya"];

export default function Keluarga() {
  const { data, loading, reload } = useApi("/households/mine", []);
  const [hhOpen, setHhOpen] = useState(false);
  const [mOpen, setMOpen] = useState(false);
  const [hh, setHh] = useState({ kk_number: "", address: "", head_name: "" });
  const [member, setMember] = useState({ full_name: "", relation: "Anak", gender: "L", birth_date: "", nik: "" });
  const [saving, setSaving] = useState(false);

  const household = data?.household;
  const members = data?.members || [];

  const saveHh = async () => {
    if (!hh.address || !hh.head_name) return toast.error("Lengkapi alamat dan nama kepala keluarga.");
    setSaving(true);
    try { await api.post("/households", hh); toast.success("Kartu Keluarga tersimpan."); setHhOpen(false); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  const saveMember = async () => {
    if (!member.full_name) return toast.error("Isi nama anggota.");
    setSaving(true);
    try { await api.post("/households/members", member); toast.success("Anggota ditambahkan."); setMOpen(false); setMember({ full_name: "", relation: "Anak", gender: "L", birth_date: "", nik: "" }); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  const delMember = async (id) => { try { await api.delete(`/households/members/${id}`); reload(); } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); } };

  if (loading) return <div><PageHeader title="Kartu Keluarga" /><Loading /></div>;

  return (
    <div>
      <PageHeader title="Kartu Keluarga" subtitle="Kelola data keluarga Anda"
        action={household && <Dialog open={hhOpen} onOpenChange={setHhOpen}><DialogTrigger asChild><Button variant="outline" className="rounded-full" data-testid="edit-kk-button">Ubah Data KK</Button></DialogTrigger>
          <KKDialog hh={hh} setHh={setHh} save={saveHh} saving={saving} prefill={household} /></Dialog>} />

      {!household ? (
        <Dialog open={hhOpen} onOpenChange={setHhOpen}>
          <EmptyState icon={IdCard} title="Belum ada Kartu Keluarga" description="Daftarkan data keluarga Anda untuk melengkapi data kependudukan RT." actionLabel="Buat Kartu Keluarga" onAction={() => setHhOpen(true)} />
          <KKDialog hh={hh} setHh={setHh} save={saveHh} saving={saving} />
        </Dialog>
      ) : (
        <>
          <div className="mb-5 overflow-hidden rounded-2xl sz-gradient p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 text-sm text-white/80"><IdCard className="h-4 w-4" /> Nomor KK</div>
            <p className="mt-1 font-mono text-xl font-bold tracking-wider">{household.kk_masked || "Tidak diisi"}</p>
            <p className="mt-2 text-sm text-white/80">Kepala Keluarga: <b>{household.head_name}</b></p>
            <p className="text-sm text-white/80">{household.address}</p>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><Users className="h-4 w-4 text-sky-500" /> Anggota Keluarga ({members.length})</h2>
            <Dialog open={mOpen} onOpenChange={setMOpen}><DialogTrigger asChild><Button size="sm" data-testid="add-member-button" className="rounded-full sz-gradient text-white"><Plus className="mr-1 h-4 w-4" /> Tambah</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Tambah Anggota Keluarga</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nama Lengkap</Label><Input data-testid="member-name-input" value={member.full_name} onChange={(e) => setMember({ ...member, full_name: e.target.value })} className="mt-1 rounded-xl" /></div>
                  <div><Label>Hubungan</Label><Select value={member.relation} onValueChange={(v) => setMember({ ...member, relation: v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Jenis Kelamin</Label><Select value={member.gender} onValueChange={(v) => setMember({ ...member, gender: v })}><SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>
                    <div><Label>Tanggal Lahir</Label><Input type="date" value={member.birth_date} onChange={(e) => setMember({ ...member, birth_date: e.target.value })} className="mt-1 rounded-xl" /></div>
                  </div>
                  <div><Label>NIK (opsional, disamarkan)</Label><Input value={member.nik} onChange={(e) => setMember({ ...member, nik: e.target.value })} className="mt-1 rounded-xl" /></div>
                </div>
                <DialogFooter><Button onClick={saveMember} disabled={saving} data-testid="member-submit-button" className="rounded-full sz-gradient text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}</Button></DialogFooter>
              </DialogContent></Dialog>
          </div>

          <div className="space-y-2.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 font-bold text-sky-700 dark:bg-sky-500/10">{m.full_name[0]}</div>
                <div className="flex-1"><p className="font-semibold text-slate-800 dark:text-slate-100">{m.full_name}</p><p className="text-xs text-slate-400">{m.relation}{m.birth_date && ` • ${fmtDate(m.birth_date)}`}{m.nik_masked && ` • ${m.nik_masked}`}</p></div>
                {m.relation !== "Kepala Keluarga" && <button onClick={() => delMember(m.id)} data-testid={`del-member-${m.id}`} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function KKDialog({ hh, setHh, save, saving, prefill }) {
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{prefill ? "Ubah" : "Buat"} Kartu Keluarga</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nomor KK</Label><Input data-testid="kk-number-input" value={hh.kk_number} onChange={(e) => setHh({ ...hh, kk_number: e.target.value })} placeholder="16 digit (disimpan aman)" className="mt-1 rounded-xl" /></div>
        <div><Label>Nama Kepala Keluarga</Label><Input data-testid="kk-head-input" value={hh.head_name} onChange={(e) => setHh({ ...hh, head_name: e.target.value })} className="mt-1 rounded-xl" /></div>
        <div><Label>Alamat</Label><Input data-testid="kk-address-input" value={hh.address} onChange={(e) => setHh({ ...hh, address: e.target.value })} className="mt-1 rounded-xl" /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={saving} data-testid="kk-submit-button" className="rounded-full sz-gradient text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}</Button></DialogFooter>
    </DialogContent>
  );
}
