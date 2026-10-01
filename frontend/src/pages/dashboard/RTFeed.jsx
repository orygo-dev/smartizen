import { useState } from "react";
import { toast } from "sonner";
import { Send, Heart, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { getAdminScope } from "@/lib/scope";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function RTFeed() {
  const { user } = useAuth();
  const scope = getAdminScope(user);
  const { data, loading, reload } = useApi(scope ? "/social/feed" : null, [scope?.id], { params: { rt_id: scope?.id } });
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try { await api.post("/social/feed", { text, category: "Info Warga" }); setText(""); toast.success("Dibagikan ke Feed RT."); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setPosting(false); }
  };

  return (
    <div>
      <PageHeader title="Feed RT" subtitle="Bagikan kabar komunitas di wilayah Anda" />
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis kabar untuk warga RT..." className="resize-none rounded-xl bg-slate-50 dark:bg-slate-800" data-testid="rt-feed-input" />
        <Button onClick={submit} disabled={posting || !text.trim()} className="mt-3 rounded-full sz-gradient text-white" data-testid="rt-feed-submit">{posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-4 w-4" /> Bagikan</>}</Button>
      </div>
      {loading ? <Loading /> : data?.length ? (
        <div className="space-y-3">{data.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-sky-100 text-xs text-sky-700">{(p.author_name || "W")[0]}</AvatarFallback></Avatar><span className="text-sm font-semibold">{p.author_name}</span><span className="ml-auto text-xs text-slate-400">{fmtDateTime(p.created_at)}</span></div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{p.text}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Heart className="h-3.5 w-3.5" /> {p.like_count || 0}</p>
          </div>))}</div>
      ) : <EmptyState title="Belum ada postingan" description="Mulai percakapan dengan warga RT Anda." />}
    </div>
  );
}
