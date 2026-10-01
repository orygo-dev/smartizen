import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { StatusChip } from "@/components/sz/StatusChip";
import { fmtDate } from "@/lib/labels";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function Residents() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, error } = useApi(scope ? "/residents" : null, [scope?.id], { params: { rt_id: scope?.id } });

  return (
    <div>
      <PageHeader title="Daftar Warga" subtitle="Warga terdaftar di wilayah RT Anda" />
      {!scope ? <EmptyState icon={Users} title="Tidak ada wilayah" description="Akun Anda belum terkait dengan wilayah RT." /> :
        loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nama</TableHead><TableHead>Nomor HP</TableHead>
                <TableHead>Bergabung</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id} data-testid={`resident-row-${r.id}`}>
                    <TableCell><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-sky-100 text-xs text-sky-700">{(r.person?.full_name || "W")[0]}</AvatarFallback></Avatar><span className="font-medium">{r.person?.full_name || "-"}</span></div></TableCell>
                    <TableCell className="text-slate-500">{r.phone || "-"}</TableCell>
                    <TableCell className="text-slate-500">{fmtDate(r.joined_at)}</TableCell>
                    <TableCell><StatusChip status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <EmptyState icon={Users} title="Belum ada warga terdaftar" description="Ajak warga lingkungan Anda untuk bergabung di Rakatin." actionLabel="Undang Warga" onAction={() => {}} />}
    </div>
  );
}
