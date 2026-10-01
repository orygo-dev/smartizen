import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { isCitizenRole } from "@/lib/labels";
import { Logo } from "@/components/sz/Logo";
import { ThemeToggle } from "@/components/sz/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(identifier, password);
      toast.success(`Selamat datang, ${u.full_name || "Warga"}!`);
      navigate(isCitizenRole(u.primary_role) ? "/app/beranda" : "/dashboard", { replace: true });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal masuk.");
    } finally { setLoading(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-blue-50 p-12 dark:bg-blue-950/30 lg:flex">
        <Logo classNameImg="h-12" />
        <div>
          <h2 className="text-4xl font-extrabold leading-tight text-slate-900 dark:text-white">Warga Terhubung,<br /><span className="text-[#0060F0]">Lingkungan</span> <span className="text-[#F38A00]">Maju</span></h2>
          <p className="mt-4 max-w-md text-slate-600 dark:text-slate-300">Kelola layanan, komunitas, dan administrasi lingkungan Anda dalam satu platform.</p>
        </div>
        <p className="text-sm text-slate-400">© {new Date().getFullYear()} Rakatin</p>
        <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
      </div>

      <div className="flex items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Logo /><ThemeToggle />
          </div>
          <div className="hidden justify-end lg:flex"><ThemeToggle /></div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Masuk ke Rakatin</h1>
          <p className="mt-1 text-sm text-slate-500">Gunakan nomor HP atau email terdaftar.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="id">Nomor HP / Email</Label>
              <Input id="id" data-testid="login-identifier-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="08xxxx atau email" className="mt-1 rounded-xl" required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">Kata Sandi</Label>
                <Link to="/lupa-sandi" className="text-xs font-semibold text-[#0060F0] hover:underline" data-testid="forgot-link">Lupa sandi?</Link>
              </div>
              <Input id="pw" type="password" data-testid="login-password-input" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="mt-1 rounded-xl" required />
            </div>
            <Button type="submit" disabled={loading} data-testid="auth-login-submit-button"
              className="w-full rounded-full sz-gradient py-6 text-base font-semibold text-white shadow-lg shadow-blue-500/30">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Masuk"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Belum punya akun?{" "}
            <Link to="/daftar/warga" className="font-semibold text-[#0060F0] hover:underline" data-testid="goto-register">Daftar sekarang</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
