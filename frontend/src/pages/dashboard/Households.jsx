import { IdCard, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Households() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, error } = useApi(scope ? "/households" : null, [scope?.id], { params: { rt_id: scope?.id } });

  return (
    <div>
      <PageHeader title="Kartu Keluarga" subtitle="Data keluarga terdaftar di wilayah RT Anda" />
      {!scope ? <EmptyState icon={IdCard} title="Tidak ada wilayah" description="Akun Anda belum terkait dengan wilayah RT." /> :
        loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <Table>
              <TableHeader><TableRow><TableHead>Kepala Keluarga</TableHead><TableHead>Nomor KK</TableHead><TableHead>Alamat</TableHead><TableHead>Anggota</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((h) => (
                  <TableRow key={h.id} data-testid={`household-row-${h.id}`}>
                    <TableCell className="font-medium">{h.head_name}</TableCell>
                    <TableCell className="font-mono text-slate-500">{h.kk_masked || "-"}</TableCell>
                    <TableCell className="text-slate-500">{h.address}</TableCell>
                    <TableCell><span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><Users className="h-3.5 w-3.5" /> {h.member_count}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <EmptyState icon={IdCard} title="Belum ada Kartu Keluarga" description="Warga belum mendaftarkan data keluarganya. Ajak warga melengkapi data KK." />}
    </div>
  );
}
