import { useState } from "react";
import { toast } from "sonner";
import { Users, Lock, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function Warga() {
  const [tab, setTab] = useState("rt");
  const { data, loading, reload } = useApi("/social/warga", [tab], { params: { tab } });

  const follow = async (p) => { await api.post(`/social/follow/${p.user_id}`); toast.success("Diperbarui."); reload(); };

  return (
    <div>
      <PageHeader title="Warga" subtitle="Temukan warga dan creator di sekitar Anda" />
      <div className="mb-4 flex gap-2">
        {[["rt", "Warga RT Saya"], ["following", "Diikuti"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`warga-tab-${k}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "sz-gradient text-white" : "bg-white text-slate-500 dark:bg-slate-900"}`}>{l}</button>
        ))}
      </div>

      {loading ? <Loading /> :
        data?.locked ? <EmptyState icon={Lock} title="Fitur Terkunci" description={data.message} /> :
        data?.items?.length ? (
          <div className="space-y-2.5">
            {data.items.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Avatar className="h-11 w-11"><AvatarFallback className="bg-sky-100 font-bold text-sky-700">{(p.display_name || "W")[0]}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800 dark:text-slate-100">{p.display_name}</p><p className="truncate text-xs text-slate-400">@{p.username}</p></div>
                <Button size="sm" variant="outline" onClick={() => follow(p)} data-testid={`follow-${p.user_id}`} className="rounded-full"><UserPlus className="mr-1 h-3.5 w-3.5" /> Ikuti</Button>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Users} title="Belum ada warga" description="Warga lain akan muncul di sini setelah bergabung dan terverifikasi." />}
    </div>
  );
}
