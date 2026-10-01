import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, ArrowRight, Upload, FileCheck2, PartyPopper, AlertTriangle } from "lucide-react";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Logo } from "@/components/sz/Logo";
import { RegionPicker } from "@/components/sz/RegionPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STEPS = [
  { t: "Akun", d: "Buat akun pengurus RT" },
  { t: "Verifikasi OTP", d: "Verifikasi nomor HP" },
  { t: "Wilayah", d: "Pilih RW & nomor RT" },
  { t: "Profil RT", d: "Data lingkungan RT" },
  { t: "Ketua RT", d: "Data pejabat RT" },
  { t: "Dokumen", d: "Unggah SK / surat" },
  { t: "Tinjau", d: "Periksa kembali" },
  { t: "Status", d: "Hasil verifikasi" },
];

export default function RegisterRT() {
  const { register, refreshUser, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [devOtp, setDevOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [region, setRegion] = useState({});
  const [rtNumber, setRtNumber] = useState("");
  const [profile, setProfile] = useState({ address: "", household_count: "", description: "" });
  const [official, setOfficial] = useState({ name: "", position: "Ketua RT", phone: "" });
  const [docs, setDocs] = useState([]);
  const [result, setResult] = useState(null);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const doRegister = async () => {
    setLoading(true);
    try {
      const payload = { full_name: account.full_name, phone: account.phone, password: account.password };
      if (account.email) payload.email = account.email;
      const res = await register(payload);
      setDevOtp(res.dev_otp || ""); setOtp(res.dev_otp || "");
      setOfficial((o) => ({ ...o, name: account.full_name, phone: account.phone }));
      toast.success("Akun pengurus dibuat.");
      next();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try { await api.post("/auth/verify-otp", { code: otp }); toast.success("Nomor terverifikasi."); next(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const addDoc = () => setDocs((d) => [...d, { type: "SK Ketua RT", name: `SK_RT_${d.length + 1}.pdf`, file_key: `private/sk_${Date.now()}.pdf` }]);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/rt/applications", {
        rw_id: region.RW, rt_number: rtNumber, rt_name: `RT ${rtNumber}`,
        profile, official, documents: docs,
      });
      setResult(data);
      await refreshUser();
      setStep(7);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const canNext = () => {
    if (step === 2) return !!region.RW && !!rtNumber;
    if (step === 4) return !!official.name;
    if (step === 5) return docs.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Button variant="ghost" onClick={() => navigate("/")} className="rounded-full"><ArrowLeft className="mr-1 h-4 w-4" /> Beranda</Button>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-4 lg:grid-cols-[260px_1fr]">
        {/* vertical stepper */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {STEPS.map((s, i) => (
              <div key={s.t} data-testid={`rt-wizard-step-${i + 1}`} className="flex gap-3 py-2.5">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${i < step ? "bg-emerald-500 text-white" : i === step ? "sz-gradient text-white" : "bg-slate-200 text-slate-400 dark:bg-slate-800"}`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div><p className={`text-sm font-semibold ${i === step ? "text-sky-600" : "text-slate-700 dark:text-slate-300"}`}>{s.t}</p><p className="text-xs text-slate-400">{s.d}</p></div>
              </div>
            ))}
          </div>
        </aside>

        {/* form pane */}
        <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-sky-500">Langkah {step + 1} / {STEPS.length}</div>
          <h1 className="mb-5 text-xl font-bold text-slate-900 dark:text-white">{STEPS[step].t}</h1>

          {step === 0 && (
            <div className="space-y-4">
              <div><Label>Nama Lengkap</Label><Input data-testid="rt-fullname-input" value={account.full_name} onChange={(e) => setAccount({ ...account, full_name: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Nomor HP</Label><Input data-testid="rt-phone-input" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Email (opsional)</Label><Input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Kata Sandi</Label><Input type="password" data-testid="rt-password-input" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} className="mt-1 rounded-xl" /></div>
              <Button onClick={doRegister} disabled={loading || !account.full_name || !account.phone || account.password.length < 6} className="w-full rounded-full sz-gradient py-6 font-semibold text-white" data-testid="rt-wizard-next-button">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Buat Akun & Lanjut <ArrowRight className="ml-1 h-4 w-4" /></>}
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {devOtp && <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">Mode dev — OTP: <b>{devOtp}</b></div>}
              <Input data-testid="rt-otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} className="rounded-xl text-center text-2xl tracking-[0.4em]" />
              <Button onClick={verifyOtp} disabled={loading} className="w-full rounded-full sz-gradient py-6 font-semibold text-white" data-testid="rt-wizard-next-button">Verifikasi & Lanjut</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Pilih wilayah hingga RW, lalu masukkan nomor RT. RT dapat mendaftar meski Desa belum bergabung.</p>
              <RegionPicker value={region} onChange={setRegion} until="RW" />
              <div><Label>Nomor RT</Label><Input data-testid="rt-number-input" value={rtNumber} onChange={(e) => setRtNumber(e.target.value)} placeholder="mis. 005" className="mt-1 rounded-xl" /></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div><Label>Alamat / Batas Wilayah RT</Label><Input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Perkiraan Jumlah KK</Label><Input type="number" value={profile.household_count} onChange={(e) => setProfile({ ...profile, household_count: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Deskripsi Singkat</Label><Textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} className="mt-1 rounded-xl" /></div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div><Label>Nama Ketua / Pengurus RT</Label><Input data-testid="rt-official-name-input" value={official.name} onChange={(e) => setOfficial({ ...official, name: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Jabatan</Label><Input value={official.position} onChange={(e) => setOfficial({ ...official, position: e.target.value })} className="mt-1 rounded-xl" /></div>
              <div><Label>Nomor HP Pengurus</Label><Input value={official.phone} onChange={(e) => setOfficial({ ...official, phone: e.target.value })} className="mt-1 rounded-xl" /></div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Unggah minimal satu dokumen pendukung (SK Ketua RT / Surat Pengangkatan). Dokumen bersifat privat.</p>
              <button onClick={addDoc} data-testid="rt-upload-doc-button" className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-8 text-slate-400 transition-colors hover:border-sky-400 hover:text-sky-500 dark:border-slate-700">
                <Upload className="h-7 w-7" /><span className="text-sm font-medium">Klik untuk mengunggah dokumen (simulasi)</span>
              </button>
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
                  <FileCheck2 className="h-5 w-5 text-emerald-500" /> <span className="font-medium">{d.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{d.type}</span>
                </div>
              ))}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3 text-sm">
              {[["Nomor RT", `RT ${rtNumber}`], ["Pengurus", official.name], ["Jabatan", official.position], ["Jumlah KK", profile.household_count || "-"], ["Dokumen", `${docs.length} berkas`]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{v}</span></div>
              ))}
              <div className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Pengajuan akan ditinjau oleh Admin Rakatin. Verifikasi tidak bergantung pada akun Desa.</div>
              <Button onClick={submit} disabled={loading} data-testid="rt-wizard-submit-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kirim Pengajuan"}
              </Button>
            </div>
          )}

          {step === 7 && result && (
            <div className="space-y-4 text-center">
              {result.conflict ? (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-rose-600"><AlertTriangle className="h-8 w-8" /></div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Konflik Klaim RT</h2>
                  <p className="text-sm text-slate-500">{result.message}</p>
                </>
              ) : (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><PartyPopper className="h-8 w-8" /></div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pengajuan Terkirim!</h2>
                  <p className="text-sm text-slate-500">Status: <b>Menunggu Verifikasi</b> oleh Admin Rakatin. Anda akan diberi tahu setelah RT diverifikasi.</p>
                </>
              )}
              <Button onClick={() => navigate("/dashboard")} data-testid="rt-goto-dashboard-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">Lihat Status Pengajuan</Button>
            </div>
          )}

          {/* nav buttons for middle steps */}
          {step >= 2 && step <= 5 && (
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={back} className="rounded-full" data-testid="rt-wizard-back-button"><ArrowLeft className="mr-1 h-4 w-4" /> Kembali</Button>
              <Button onClick={next} disabled={!canNext()} className="ml-auto rounded-full sz-gradient px-8 font-semibold text-white" data-testid="rt-wizard-next-button">Lanjut <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
