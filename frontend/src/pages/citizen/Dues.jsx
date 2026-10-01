import { toast } from "sonner";
import { Wallet, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { rupiah, fmtDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export default function Dues() {
  const { data, loading, error, reload } = useApi("/civic/dues", []);

  const pay = async (d) => {
    try {
      await api.post(`/civic/dues/${d.id}/pay`);
      toast.success("Pembayaran berhasil (simulasi QRIS)."); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div>
      <PageHeader title="Iuran Warga" subtitle="Bayar dan pantau iuran lingkungan Anda" />
      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="space-y-3">
            {data.map((d) => (
              <div key={d.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Wallet className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{d.title}</p>
                  <p className="text-sm text-slate-500">{rupiah(d.amount)} • {d.period === "monthly" ? "Bulanan" : d.period === "one_time" ? "Sekali" : "Kegiatan"}{d.due_date && ` • Jatuh tempo ${fmtDate(d.due_date)}`}</p>
                </div>
                {d.my_status === "PAID" ? <StatusChip status="PAID" /> :
                  <Button onClick={() => pay(d)} data-testid={`dues-pay-${d.id}`} className="rounded-full sz-gradient font-semibold text-white">Bayar</Button>}
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Wallet} title="Belum ada iuran" description="Belum ada tagihan iuran dari RT Anda saat ini." />}
    </div>
  );
}
