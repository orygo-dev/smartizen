import { useNavigate } from "react-router-dom";
import { FileText, MessageSquareWarning, Wallet, CalendarDays, Users, Newspaper, Store, Clapperboard, IdCard, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/sz/PageHeader";

const SERVICES = [
  { to: "/app/surat", label: "Layanan Surat", desc: "Surat pengantar & domisili", icon: FileText, tone: "from-sky-500 to-blue-600", testId: "civic-service-surat-button" },
  { to: "/app/pengaduan", label: "Pengaduan", desc: "Laporkan masalah lingkungan", icon: MessageSquareWarning, tone: "from-rose-500 to-pink-600", testId: "civic-service-pengaduan-button" },
  { to: "/app/iuran", label: "Iuran Warga", desc: "Bayar & pantau iuran", icon: Wallet, tone: "from-emerald-500 to-teal-600", testId: "civic-service-iuran-button" },
  { to: "/app/keluarga", label: "Kartu Keluarga", desc: "Kelola data keluarga", icon: IdCard, tone: "from-cyan-500 to-sky-600", testId: "civic-service-keluarga-button" },
  { to: "/app/agenda", label: "Agenda", desc: "Kegiatan & acara RT", icon: CalendarDays, tone: "from-amber-500 to-orange-500" },
  { to: "/app/chat", label: "Chat", desc: "Pesan warga & pengurus RT", icon: MessageCircle, tone: "from-teal-500 to-emerald-600" },
  { to: "/app/feed", label: "Feed Warga", desc: "Kabar & diskusi komunitas", icon: Newspaper, tone: "from-sky-500 to-cyan-600" },
  { to: "/app/warga", label: "Warga", desc: "Temukan warga & creator", icon: Users, tone: "from-violet-500 to-purple-600" },
  { to: "/app/marketplace", label: "Marketplace", desc: "UMKM lokal (segera)", icon: Store, tone: "from-fuchsia-500 to-purple-600" },
  { to: "/app/reels", label: "Reels", desc: "Video singkat (segera)", icon: Clapperboard, tone: "from-pink-500 to-rose-600" },
];

export default function Services() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Layanan" subtitle="Semua layanan lingkungan dalam satu tempat" />
      <div className="grid grid-cols-2 gap-3">
        {SERVICES.map((s) => (
          <button key={s.to} onClick={() => navigate(s.to)} data-testid={s.testId}
            className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${s.tone} text-white shadow-md`}><s.icon className="h-6 w-6" /></div>
            <p className="mt-3 font-bold text-slate-800 dark:text-slate-100">{s.label}</p>
            <p className="text-xs text-slate-500">{s.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
