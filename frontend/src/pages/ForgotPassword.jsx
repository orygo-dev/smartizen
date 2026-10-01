import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Logo } from "@/components/sz/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");

  const request = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/forgot-password", { identifier });
      setSent(true);
      if (data.dev_token) { setToken(data.dev_token); toast.info("Mode dev: token reset terisi otomatis."); }
      else toast.success("Jika terdaftar, tautan reset telah dikirim.");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const reset = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Kata sandi berhasil diubah. Silakan masuk.");
      window.location.href = "/login";
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6"><Logo /></div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Lupa Kata Sandi</h1>
        {!sent ? (
          <form onSubmit={request} className="mt-6 space-y-4">
            <div>
              <Label>Nomor HP / Email</Label>
              <Input data-testid="forgot-identifier-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-1 rounded-xl" required />
            </div>
            <Button type="submit" data-testid="forgot-submit-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">Kirim Tautan Reset</Button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-6 space-y-4">
            <div>
              <Label>Token Reset</Label>
              <Input data-testid="reset-token-input" value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 rounded-xl" required />
            </div>
            <div>
              <Label>Kata Sandi Baru</Label>
              <Input type="password" data-testid="reset-password-input" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 rounded-xl" required />
            </div>
            <Button type="submit" data-testid="reset-submit-button" className="w-full rounded-full sz-gradient py-6 font-semibold text-white">Ubah Kata Sandi</Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-sky-600 hover:underline">Kembali ke Masuk</Link>
        </p>
      </div>
    </div>
  );
}
