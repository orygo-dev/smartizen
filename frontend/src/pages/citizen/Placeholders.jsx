import { Store, Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/sz/PageHeader";
import { EmptyState } from "@/components/sz/States";

export function Marketplace() {
  return (
    <div>
      <PageHeader title="Marketplace" subtitle="UMKM dan produk lokal di sekitar Anda" />
      <EmptyState icon={Store} title="Marketplace Segera Hadir" description="Fitur UMKM lokal sedang disiapkan. Anda akan dapat menemukan dan mendukung usaha tetangga di sini." />
    </div>
  );
}

export function Reels() {
  return (
    <div>
      <PageHeader title="Reels" subtitle="Video singkat dari warga dan creator lokal" />
      <EmptyState icon={Clapperboard} title="Reels Segera Hadir" description="Konten video singkat komunitas akan tersedia di pembaruan berikutnya." />
    </div>
  );
}
