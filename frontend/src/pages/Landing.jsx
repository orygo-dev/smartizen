import { useNavigate } from "react-router-dom";
import { Users, HeartHandshake, Store, Megaphone, FileText, Wallet, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/sz/Logo";
import { ThemeToggle } from "@/components/sz/ThemeToggle";

const FEATURES = [
  { icon: Megaphone, title: "Informasi Lingkungan", desc: "Pengumuman, agenda, dan kabar RT/RW langsung di genggaman." },
  { icon: FileText, title: "Layanan Surat Online", desc: "Ajukan surat pengantar & domisili tanpa antre, lengkap dengan QR." },
  { icon: MessageIcon, title: "Pengaduan Warga", desc: "Laporkan masalah lingkungan dan pantau statusnya transparan." },
  { icon: Wallet, title: "Iuran Digital", desc: "Bayar iuran warga mudah, rekap keuangan RT jelas & akuntabel." },
  { icon: Store, title: "UMKM Lokal", desc: "Temukan & dukung usaha tetangga sekitar lingkungan Anda." },
  { icon: HeartHandshake, title: "Komunitas Hidup", desc: "Feed, story, dan interaksi antarwarga yang menguatkan gotong royong." },
];

function MessageIcon(props) { return <HeartHandshake {...props} />; }

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login-button" className="rounded-full font-semibold">Masuk</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:py-20">
          <div className="sz-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Ekosistem Digital Warga Indonesia
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Warga Terhubung, <span className="sz-gradient-text">Lingkungan Maju</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Rakatin menyatukan pelayanan warga, administrasi RT/RW digital, komunitas lokal,
              dan UMKM sekitar dalam satu aplikasi yang mudah digunakan.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" data-testid="auth-register-warga-button" onClick={() => navigate("/daftar/warga")}
                className="group rounded-full sz-gradient px-7 text-base font-semibold text-white shadow-lg shadow-blue-500/30">
                <Users className="mr-2 h-5 w-5" /> Daftar sebagai Warga
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" data-testid="auth-register-rt-button" onClick={() => navigate("/daftar/rt")}
                className="rounded-full border-2 px-7 text-base font-semibold">
                <ShieldCheck className="mr-2 h-5 w-5" /> Daftar sebagai RT
              </Button>
            </div>
          </div>
          <div className="relative sz-fade-up">
            <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
            <img src="https://images.unsplash.com/photo-1774370793401-4206e5fae59e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
              alt="Kehidupan warga di lingkungan RT Indonesia"
              className="relative rounded-3xl border border-white/40 object-cover shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Satu aplikasi untuk seluruh kebutuhan lingkungan
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#0060F0] text-white shadow-md">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="overflow-hidden rounded-3xl sz-gradient px-8 py-12 text-center shadow-xl">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Mulai digitalisasi lingkungan Anda hari ini</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/80">Gratis untuk warga. RT dapat mendaftar mandiri tanpa menunggu Desa.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/daftar/warga")} className="rounded-full bg-white px-7 font-semibold text-blue-600 hover:bg-white/90">Daftar Warga</Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/daftar/rt")} className="rounded-full border-2 border-white/70 bg-transparent px-7 font-semibold text-white hover:bg-white/10">Daftar RT</Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
        © {new Date().getFullYear()} Rakatin — Warga Terhubung, Lingkungan Maju
      </footer>
    </div>
  );
}
