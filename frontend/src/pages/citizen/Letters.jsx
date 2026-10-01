import { useState, useRef } from "react";
import { toast } from "sonner";
import { FileText, Plus, Download, QrCode, Loader2, Paperclip, X } from "lucide-react";
import { api, API, formatApiError, uploadFile, mediaUrl } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Letters() {
  const { data: types } = useApi("/civic/letter-types", []);
  const { data, loading, error, reload } = useApi("/civic/letters", [], { params: { mine: true } });
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [fields, setFields] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const fileRef = useRef(null);

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name} terlalu besar (maks 15 MB).`); continue; }
        const up = await uploadFile(f);
        setAttachments((prev) => [...prev, { name: up.filename || f.name, url: up.url, content_type: up.content_type }]);
      }
    } catch { toast.error("Gagal mengunggah lampiran."); }
    finally { setUploading(false); }
  };

  const removeAttachment = (i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  const downloadPdf = async (l) => {
    try {
      const res = await api.get(`/civic/letters/${l.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (e) { toast.error("Gagal mengunduh PDF."); }
  };

  const selectedType = types?.find((t) => t.id === typeId);

  const submit = async () => {
    if (!typeId) return toast.error("Pilih jenis surat.");
    setSubmitting(true);
    try {
      await api.post("/civic/letters", { letter_type_id: typeId, data: fields, attachments });
      toast.success("Pengajuan surat terkirim."); setOpen(false); setFields({}); setTypeId(""); setAttachments([]); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="Layanan Surat" subtitle="Ajukan surat pengantar dan keterangan"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="letter-create-button" className="rounded-full sz-gradient font-semibold text-white"><Plus className="mr-1 h-4 w-4" /> Ajukan Surat</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajukan Surat Baru</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Jenis Surat</Label>
                  <Select value={typeId} onValueChange={setTypeId}>
                    <SelectTrigger data-testid="letter-type-select" className="mt-1 rounded-xl"><SelectValue placeholder="Pilih jenis surat" /></SelectTrigger>
                    <SelectContent>{types?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {selectedType?.fields?.map((f) => (
                  <div key={f.key}><Label>{f.label}</Label><Input value={fields[f.key] || ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} className="mt-1 rounded-xl" /></div>
                ))}
                <div>
                  <Label>Lampiran Pendukung (opsional)</Label>
                  <p className="mb-1.5 mt-0.5 text-xs text-slate-400">Unggah KTP, KK, atau dokumen lain untuk mempercepat verifikasi. (Foto/PDF, maks 15 MB)</p>
                  <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onPickFiles} data-testid="letter-attachment-input" />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="letter-attachment-button" className="rounded-full">
                    {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Paperclip className="mr-1.5 h-4 w-4" />} Tambah Lampiran
                  </Button>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {attachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{a.name}</span>
                          <button type="button" onClick={() => removeAttachment(i)} data-testid={`letter-attachment-remove-${i}`} className="text-slate-400 hover:text-rose-500"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedType && <p className="text-xs text-slate-400">Alur: {selectedType.workflow.join(" → ")} → Selesai</p>}
              </div>
              <DialogFooter><Button onClick={submit} disabled={submitting} data-testid="letter-submit-button" className="rounded-full sz-gradient text-white">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((l) => (
              <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{l.letter_type_name}</p>
                    <p className="text-xs text-slate-400">{fmtDate(l.created_at)} {l.doc_number && `• No: ${l.doc_number}`}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusChip status={l.status} />
                      <span className="text-xs text-slate-400">Tahap {Math.min(l.current_step + 1, l.workflow.length)}/{l.workflow.length}</span>
                    </div>
                  </div>
                  {l.status === "VERIFIED" && (
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => downloadPdf(l)} data-testid="letter-download-button" className="rounded-full"><Download className="mr-1 h-3.5 w-3.5" /> PDF</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDetail(l)} className="rounded-full"><QrCode className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={FileText} title="Belum ada pengajuan surat" description="Ajukan surat pengantar atau keterangan dengan mudah di sini." actionLabel="Ajukan Surat" onAction={() => setOpen(true)} />}

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pratinjau Surat</DialogTitle></DialogHeader>
          {detail && (
            <div className="rounded-xl border border-slate-200 p-6 dark:border-slate-700">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-slate-400">Rakatin</p>
                <h3 className="mt-1 text-lg font-bold">{detail.letter_type_name}</h3>
                <p className="text-sm text-slate-500">No: {detail.doc_number}</p>
              </div>
              <div className="my-4 border-t border-dashed" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Dengan ini menerangkan bahwa <b>{detail.requester_name}</b> adalah benar warga dan telah mengajukan {detail.letter_type_name}.</p>
              {Object.entries(detail.data || {}).map(([k, v]) => <p key={k} className="mt-1 text-sm text-slate-500">{k}: {v}</p>)}
              {detail.attachments?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-500">Lampiran:</p>
                  <div className="mt-1 space-y-1">
                    {detail.attachments.map((a, i) => (
                      <a key={i} href={mediaUrl(a.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-sky-600 hover:underline"><Paperclip className="h-3.5 w-3.5" /> {a.name}</a>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-5 flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800"><QrCode className="h-10 w-10 text-slate-600" /></div>
                <p className="text-xs text-slate-400">Pindai QR untuk verifikasi keaslian dokumen di Rakatin.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
