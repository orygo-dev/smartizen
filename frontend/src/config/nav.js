import {
  LayoutDashboard, Users, UserCheck, FileText, MessageSquareWarning, Megaphone,
  CalendarDays, Wallet, Newspaper, Building2, ShieldCheck, Map, Settings,
  Network, BadgeCheck, Scale, FolderKanban, Sparkles,
} from "lucide-react";

// Role-aware sidebar. Backend still enforces authorization; hiding menus is not security.
export const NAV_CONFIG = {
  SUPER_ADMIN: [
    { group: "Utama", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    { group: "Administrasi", items: [
      { to: "/dashboard/rt-applications", label: "Pengajuan RT", icon: BadgeCheck },
      { to: "/dashboard/claims", label: "Konflik Klaim", icon: Scale },
      { to: "/dashboard/regions", label: "Wilayah", icon: Map },
    ]},
    { group: "Civic", items: [
      { to: "/dashboard/complaints", label: "Pengaduan", icon: MessageSquareWarning },
      { to: "/dashboard/letters", label: "Surat", icon: FileText },
    ]},
    { group: "UMKM", items: [{ to: "/dashboard/umkm", label: "UMKM Unggulan", icon: Sparkles }] },
    { group: "Sistem", items: [
      { to: "/dashboard/audit", label: "Audit Log", icon: FolderKanban },
      { to: "/dashboard/settings", label: "Pengaturan", icon: Settings },
    ]},
  ],
  RT_HEAD: [
    { group: "Utama", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    { group: "Warga", items: [
      { to: "/dashboard/residents", label: "Daftar Warga", icon: Users },
      { to: "/dashboard/pending", label: "Menunggu Verifikasi", icon: UserCheck },
      { to: "/dashboard/households", label: "Kartu Keluarga", icon: BadgeCheck },
    ]},
    { group: "Layanan", items: [
      { to: "/dashboard/letters", label: "Surat", icon: FileText },
      { to: "/dashboard/complaints", label: "Pengaduan", icon: MessageSquareWarning },
      { to: "/dashboard/announcements", label: "Pengumuman", icon: Megaphone },
      { to: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
    ]},
    { group: "Keuangan", items: [{ to: "/dashboard/dues", label: "Iuran", icon: Wallet }] },
    { group: "Komunitas", items: [
      { to: "/dashboard/feed", label: "Feed RT", icon: Newspaper },
      { to: "/dashboard/umkm", label: "UMKM Unggulan", icon: Sparkles },
    ]},
    { group: "Aktivasi", items: [{ to: "/dashboard/activation", label: "Undang & QR RT", icon: Network }] },
  ],
  REGION_ADMIN: [ // RW / VILLAGE / DISTRICT / REGENCY share an aggregate layout
    { group: "Utama", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    { group: "Wilayah", items: [{ to: "/dashboard/sub-regions", label: "Wilayah Bawahan", icon: Building2 }] },
    { group: "Pelayanan", items: [
      { to: "/dashboard/complaints", label: "Pengaduan", icon: MessageSquareWarning },
      { to: "/dashboard/letters", label: "Surat", icon: FileText },
      { to: "/dashboard/announcements", label: "Pengumuman", icon: Megaphone },
      { to: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
    ]},
  ],
};

export function navForRole(role) {
  if (role === "SUPER_ADMIN") return NAV_CONFIG.SUPER_ADMIN;
  if (["RT_HEAD", "RT_SECRETARY", "RT_TREASURER", "RT_OPERATOR"].includes(role)) return NAV_CONFIG.RT_HEAD;
  return NAV_CONFIG.REGION_ADMIN;
}
