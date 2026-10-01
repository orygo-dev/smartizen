import { useNavigate } from "react-router-dom";
import { FileText, MessageSquareWarning, Wallet, CalendarDays, Megaphone, Users, MapPin } from "lucide-react";
import { UmkmNearby } from "@/components/sz/UmkmNearby";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Loading } from "@/components/sz/States";
import { StoryBar } from "@/components/sz/StoryBar";
import { fmtDate } from "@/lib/labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const QUICK = [
  { to: "/app/surat", label: "Surat", icon: FileText, tone: "from-sky-500 to-blue-600" },
  { to: "/app/pengaduan", label: "Pengaduan", icon: MessageSquareWarning, tone: "from-rose-500 to-pink-600" },
  { to: "/app/iuran", label: "Iuran", icon: Wallet, tone: "from-emerald-500 to-teal-600" },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays, tone: "from-amber-500 to-orange-500" },
];

export default function CitizenHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: mem } = useApi("/residents/my-membership", []);
  const { data: anns, loading: la } = useApi("/civic/announcements", []);
  const { data: feed } = useApi("/social/feed", []);

  const regionName = mem?.region_path?.map((r) => r.name).slice(-2).join(", ");
  const first = user?.full_name?.split(" ")[0] || "Warga";

  return (
    <div className="space-y-6">
      {/* greeting */}
      <div className="sz-fade-up overflow-hidden rounded-2xl sz-gradient p-5 text-white shadow-lg">
        <p className="text-sm text-white/80">Selamat datang kembali,</p>
        <h1 className="text-2xl font-extrabold">{first} 👋</h1>
        {regionName && <p className="mt-1 flex items-center gap-1 text-sm text-white/80"><MapPin className="h-3.5 w-3.5" /> {regionName}</p>}
      </div>

      {/* story row */}
      <StoryBar />

      <UmkmNearby />

      {/* quick services */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Layanan Cepat</h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK.map((q) => (
            <button key={q.to} onClick={() => navigate(q.to)} data-testid={`quick-${q.label.toLowerCase()}`} className="flex flex-col items-center gap-2">
              <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${q.tone} text-white shadow-md transition-transform active:scale-95`}><q.icon className="h-6 w-6" /></div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RT announcements */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><Megaphone className="h-4 w-4 text-sky-500" /> Informasi RT</h2>
        </div>
        {la ? <Loading rows={1} /> : (anns?.length ? (
          <div className="space-y-2.5">
            {anns.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.body}</p>
                <p className="mt-2 text-xs text-slate-400">{fmtDate(a.created_at)}</p>
              </div>
            ))}
          </div>
        ) : <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-slate-800">Belum ada informasi dari RT Anda.</p>)}
      </section>

      {/* local feed preview */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><Users className="h-4 w-4 text-teal-500" /> Kabar Warga</h2>
          <button onClick={() => navigate("/app/feed")} className="text-xs font-semibold text-sky-600" data-testid="see-all-feed">Lihat semua</button>
        </div>
        {feed?.length ? (
          <div className="space-y-2.5">
            {feed.slice(0, 2).map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-sky-100 text-xs text-sky-700">{(p.author_name || "W")[0]}</AvatarFallback></Avatar><span className="text-sm font-semibold">{p.author_name || "Warga"}</span><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{p.category}</span></div>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{p.text}</p>
              </div>
            ))}
          </div>
        ) : <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-slate-800">Jadilah yang pertama berbagi kabar di lingkungan Anda.</p>}
      </section>

    </div>
  );
}
