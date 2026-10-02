export const STATUS_LABELS = {
  DRAFT: "Draf", PENDING_REVIEW: "Menunggu Verifikasi", NEED_REVISION: "Perlu Revisi",
  VERIFIED: "Terverifikasi", REJECTED: "Ditolak", CONFLICT: "Konflik Klaim", SUSPENDED: "Dinonaktifkan",
  PENDING: "Menunggu", PENDING_RT_VERIFICATION: "Menunggu RT Bergabung", ACTIVE: "Aktif", ENDED: "Berakhir",
  SUBMITTED: "Terkirim", ASSIGNED: "Ditugaskan", IN_PROGRESS: "Sedang Diproses", RESOLVED: "Selesai",
  PAID: "Lunas", UNPAID: "Belum Bayar", UNCLAIMED: "Belum Bergabung",
  RESOLVED_REPLACED: "Pengurus Diganti", RESOLVED_KEPT: "Dipertahankan", NEED_EVIDENCE: "Perlu Bukti",
  ACCEPTED: "Diterima", COMPLETED: "Selesai", CANCELLED: "Dibatalkan",
};

export const STATUS_TONE = {
  VERIFIED: "emerald", ACTIVE: "emerald", RESOLVED: "teal", PAID: "emerald", RESOLVED_KEPT: "slate",
  PENDING: "amber", PENDING_REVIEW: "amber", PENDING_RT_VERIFICATION: "amber", SUBMITTED: "sky",
  ASSIGNED: "sky", IN_PROGRESS: "cyan", NEED_REVISION: "amber", NEED_EVIDENCE: "amber", UNPAID: "rose",
  REJECTED: "rose", CONFLICT: "rose", SUSPENDED: "rose", DRAFT: "slate", ENDED: "slate", UNCLAIMED: "slate",
  ACCEPTED: "sky", COMPLETED: "emerald", CANCELLED: "slate",
};

export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin", REGENCY_ADMIN: "Admin Kabupaten/Kota", DISTRICT_ADMIN: "Admin Kecamatan",
  VILLAGE_ADMIN: "Admin Kelurahan/Desa", VILLAGE_VERIFIER: "Verifikator Kelurahan",
  RW_HEAD: "Ketua RW", RW_OPERATOR: "Operator RW", RT_HEAD: "Ketua RT", RT_SECRETARY: "Sekretaris RT",
  RT_TREASURER: "Bendahara RT", RT_OPERATOR: "Operator RT", RESIDENT: "Warga", HOUSEHOLD_HEAD: "Kepala Keluarga",
  HOUSEHOLD_MEMBER: "Anggota Keluarga", MERCHANT: "UMKM", CREATOR: "Kreator", MODERATOR: "Moderator",
  SUPPORT: "Dukungan", AUDITOR: "Auditor",
};

export const label = (s) => STATUS_LABELS[s] || s;
export const roleLabel = (r) => ROLE_LABELS[r] || r;

export const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch { return s; }
};
export const fmtDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
};

export const CITIZEN_ROLES = ["RESIDENT", "HOUSEHOLD_HEAD", "HOUSEHOLD_MEMBER", "MERCHANT", "CREATOR"];
export const isCitizenRole = (r) => CITIZEN_ROLES.includes(r);
