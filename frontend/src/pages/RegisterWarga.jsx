import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, PartyPopper, Info } from "lucide-react";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Logo } from "@/components/sz/Logo";
import { RegionPicker } from "@/components/sz/RegionPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = ["Akun", "Verifikasi OTP", "Pilih Wilayah"];

export default function RegisterWarga() {
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [devOtp, setDevOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [region, setRegion] = useState({});
  const [rtResult, setRtResult] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const doRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { full_name: form.full_name, phone: form.phone, password: form.password };
      if (form.email) payload.email = form.email;
      const res = await register(payload);
      setDevOtp(res.dev_otp || "");
      setOtp(res.dev_otp || "");
      toast.success("Akun dibuat! Verifikasi nomor HP Anda.");
      setStep(1);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      await api.post("/auth/verify-otp", { code: otp });
      toast.success("Nomor HP terverifikasi.");
      setStep(2);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const chooseRegion = async () => {
    if (!region.RT) return toast.error("Silakan pilih RT Anda.");
    setLoading(true);
    try {
      const { data } = await api.post("/residents/membership", { rt_id: region.RT });
      setRtResult(data);
      await refreshUser();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <Button variant="ghost" onClick={() => navigate("/")} className="rounded-full"><ArrowLeft className="mr-1 h-4 w-4" /> Beranda</Button>
      </header>

      <div className="mx-auto max-w-xl px-5 py-6">
        {/* stepper */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-all ${i < step ? "bg-emerald-500 text-white" : i === step ? "sz-gradient text-white" : "bg-slate-200 text-slate-400 dark:bg-slate-800"}`}>
                  {i < step ? <Check className="h-5 w-5" /> : i + 1}
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-slate-500">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 ${i < step ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {step === 0 && (
            <form onSubmit={doRegister} className="space-y-4">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Daftar sebagai Warga</h1>
              <div><Label>Nama Lengkap</Label><Input data-testid="reg-fullname-input" value={form.full_name} onChange={set("full_name")} className="mt-1 rounded-xl" required /></div>
              <div><Label>Nomor HP</Label><Input data-testid="reg-phone-input" value={form.phone} onChange={set("phone")} placeholder="08xxxxxxxxxx" className="mt-1 rounded-xl" required /></div>
              <div><Label>Email (opsional)</Label><Input type="email" data-testid="reg-email-input" value={form.email} onChange={set("email")} className="mt-1 rounded-xl" /></div>
              <div><Label>Kata Sandi</Label><Input type="password" data-testid="reg-password-input" value={form.password} onChange={set("password")} className="mt-1 rounded-xl" required minLength={6} /></div>
              <Button type="submit" disabled={loading} data-testid="reg-submit-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Lanjutkan"}
              </Button>
              <p className="text-center text-sm text-slate-500">Sudah punya akun? <Link to="/login" className="font-semibold text-sky-600">Masuk</Link></p>
            </form>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Verifikasi Nomor HP</h1>
              <p className="text-sm text-slate-500">Masukkan 6 digit kode OTP yang dikirim ke {form.phone}.</p>
              {devOtp && <div className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><Info className="h-4 w-4" /> Mode dev — kode OTP: <b>{devOtp}</b></div>}
              <Input data-testid="otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} className="rounded-xl text-center text-2xl tracking-[0.4em]" />
              <Button onClick={verifyOtp} disabled={loading} data-testid="otp-verify-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verifikasi"}
              </Button>
            </div>
          )}

          {step === 2 && !rtResult && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Wilayah Anda</h1>
              <p className="text-sm text-slate-500">Pilih RT tempat tinggal Anda. Jika RT belum bergabung, Anda tetap bisa menggunakan Rakatin.</p>
              <RegionPicker value={region} onChange={setRegion} until="RT" />
              <Button onClick={chooseRegion} disabled={loading || !region.RT} data-testid="region-submit-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Selesai"}
              </Button>
            </div>
          )}

          {step === 2 && rtResult && (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><PartyPopper className="h-8 w-8" /></div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pendaftaran Berhasil!</h1>
              <p className="text-sm text-slate-500">{rtResult.message}</p>
              {!rtResult.rt_joined && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  RT Anda belum bergabung di Rakatin. Anda tetap dapat menikmati fitur umum.
                  <Button variant="outline" className="mt-3 w-full rounded-full" data-testid="invite-rt-button"
                    onClick={async () => { await api.post("/rt/invite", { rt_id: rtResult.membership.rt_id }); toast.success("Undangan Ketua RT dibuat."); }}>
                    Undang Ketua RT
                  </Button>
                </div>
              )}
              <Button onClick={() => navigate("/app/beranda")} data-testid="goto-app-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">Masuk Aplikasi</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
