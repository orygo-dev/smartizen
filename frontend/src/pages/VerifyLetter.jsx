import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/sz/Logo";
import { fmtDateTime } from "@/lib/labels";

export default function VerifyLetter() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/civic/letters/verify/${id}`).then(({ data }) => setData(data)).catch(() => setData({ valid: false })).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? <p className="text-slate-400">Memverifikasi...</p> : data?.valid ? (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-9 w-9" /></div>
              <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Dokumen Sah</h1>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-emerald-600"><ShieldCheck className="h-4 w-4" /> Terverifikasi oleh Rakatin</p>
              <div className="mt-5 space-y-2 text-left text-sm">
                {[["Jenis Surat", data.letter_type_name], ["Nomor", data.doc_number], ["Atas Nama", data.requester_name], ["Diterbitkan", fmtDateTime(data.verified_at)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{v || "-"}</span></div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-rose-600"><XCircle className="h-9 w-9" /></div>
              <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Dokumen Tidak Valid</h1>
              <p className="mt-1 text-sm text-slate-500">Dokumen tidak ditemukan atau belum diterbitkan secara resmi.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
