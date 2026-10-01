import { toast } from "sonner";
import { Network, QrCode, Copy, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Section } from "@/components/sz/PageHeader";
import { Button } from "@/components/ui/button";

export default function Activation() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const link = `${window.location.origin}/daftar/warga?rt=${scope?.id || ""}`;
  return (
    <div>
      <PageHeader title="Aktivasi Rakatin" subtitle="Ajak warga bergabung & pantau adopsi RT Anda" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Undang Warga">
          <p className="text-sm text-slate-500">Bagikan tautan ini agar warga dapat mendaftar langsung ke RT Anda.</p>
          <div className="mt-3 flex gap-2">
            <code className="flex-1 truncate rounded-xl bg-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{link}</code>
            <Button onClick={() => { navigator.clipboard?.writeText(link); toast.success("Tautan disalin."); }} data-testid="copy-invite-link" className="rounded-full sz-gradient text-white"><Copy className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" className="mt-3 w-full rounded-full" data-testid="invite-warga-button"><UserPlus className="mr-2 h-4 w-4" /> Kirim Undangan</Button>
        </Section>
        <Section title="QR Code RT">
          <div className="flex flex-col items-center py-4">
            <div className="grid h-40 w-40 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800"><QrCode className="h-24 w-24 text-slate-600 dark:text-slate-300" /></div>
            <p className="mt-3 text-center text-sm text-slate-500">Tempel QR ini di papan pengumuman RT agar warga mudah bergabung.</p>
          </div>
        </Section>
      </div>
      <Section title="Statistik Aktivasi" className="mt-4">
        <div className="flex items-center gap-3 text-sm text-slate-500"><Network className="h-5 w-5 text-sky-500" /> Statistik adopsi akan diperbarui otomatis seiring warga bergabung.</div>
      </Section>
    </div>
  );
}
