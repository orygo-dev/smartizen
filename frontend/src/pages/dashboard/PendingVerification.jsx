import { toast } from "sonner";
import { UserCheck, Check, X } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDate } from "@/lib/labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function PendingVerification() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, error, reload } = useApi(scope ? "/residents" : null, [scope?.id], { params: { rt_id: scope?.id, status: "PENDING" } });

  const act = async (m, action) => {
    try {
      await api.post(`/residents/membership/${m.id}/verify`, { action });
      toast.success(action === "APPROVE" ? "Warga diverifikasi." : "Keanggotaan ditolak."); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Menunggu Verifikasi" subtitle="Setujui warga baru yang mendaftar di RT Anda" />
      {!scope ? <EmptyState title="Tidak ada wilayah" description="Akun Anda belum terkait wilayah RT." /> :
        loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Avatar className="h-11 w-11"><AvatarFallback className="bg-amber-100 font-bold text-amber-700">{(r.person?.full_name || "W")[0]}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800 dark:text-slate-100">{r.person?.full_name || "Warga"}</p><p className="text-xs text-slate-400">{r.phone} • Daftar {fmtDate(r.joined_at)}</p></div>
                <Button size="sm" onClick={() => act(r, "APPROVE")} data-testid={`approve-${r.id}`} className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"><Check className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => act(r, "REJECT")} data-testid={`reject-${r.id}`} className="rounded-full border-rose-200 text-rose-600"><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={UserCheck} title="Tidak ada antrean verifikasi" description="Semua warga sudah terverifikasi. Kerja bagus!" />}
    </div>
  );
}
