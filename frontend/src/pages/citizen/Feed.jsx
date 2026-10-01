import { useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle, Send, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATS = ["Umum", "Kegiatan", "Info Warga", "UMKM", "Lingkungan", "Kehilangan", "Acara", "Jual/Beli"];

function PostCard({ post, onLike }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9"><AvatarFallback className="bg-sky-100 text-sm font-bold text-sky-700">{(post.author_name || "W")[0]}</AvatarFallback></Avatar>
        <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{post.author_name || "Warga"}</p><p className="text-xs text-slate-400">{fmtDateTime(post.created_at)}</p></div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800">{post.category}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{post.text}</p>
      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button onClick={() => onLike(post)} data-testid="feed-like-button" className={`flex items-center gap-1.5 text-sm font-medium ${post.liked_by_me ? "text-rose-500" : "text-slate-500"}`}>
          <Heart className={`h-4 w-4 ${post.liked_by_me ? "fill-current" : ""}`} /> {post.like_count || 0}
        </button>
        <button data-testid="feed-comment-button" className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <MessageCircle className="h-4 w-4" /> {post.comment_count || 0}
        </button>
      </div>
    </div>
  );
}

export default function Feed() {
  const [cat, setCat] = useState("Semua");
  const [text, setText] = useState("");
  const [newCat, setNewCat] = useState("Umum");
  const [posting, setPosting] = useState(false);
  const { data, loading, error, reload, setData } = useApi("/social/feed", [cat], { params: cat !== "Semua" ? { category: cat } : {} });

  const submit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post("/social/feed", { text, category: newCat });
      setText(""); toast.success("Postingan dibagikan!"); reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setPosting(false); }
  };

  const like = async (post) => {
    const { data: r } = await api.post(`/social/feed/${post.id}/like`);
    setData((d) => d.map((p) => p.id === post.id ? { ...p, liked_by_me: r.liked, like_count: r.like_count } : p));
  };

  return (
    <div>
      <PageHeader title="Feed Warga" subtitle="Kabar dan diskusi lingkungan Anda" />
      {/* composer */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Textarea data-testid="feed-post-create-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Bagikan sesuatu dengan warga..." className="resize-none rounded-xl border-none bg-slate-50 focus-visible:ring-1 dark:bg-slate-800" />
        <div className="mt-3 flex items-center gap-2">
          <Select value={newCat} onValueChange={setNewCat}>
            <SelectTrigger className="w-40 rounded-full" data-testid="feed-category-select"><SelectValue /></SelectTrigger>
            <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={submit} disabled={posting || !text.trim()} data-testid="feed-post-submit-button" className="ml-auto rounded-full sz-gradient font-semibold text-white">
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-4 w-4" /> Bagikan</>}
          </Button>
        </div>
      </div>

      {/* category tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto sz-scroll-x pb-1">
        {["Semua", ...CATS].map((c) => (
          <button key={c} onClick={() => setCat(c)} data-testid={`feed-filter-${c}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${cat === c ? "sz-gradient text-white" : "bg-white text-slate-500 dark:bg-slate-900"}`}>{c}</button>
        ))}
      </div>

      {loading ? <Loading /> : error ? <EmptyState title="Gagal memuat" description={error} /> :
        data?.length ? <div className="space-y-3">{data.map((p) => <PostCard key={p.id} post={p} onLike={like} />)}</div> :
        <EmptyState title="Belum ada postingan" description="Jadilah yang pertama berbagi kabar di lingkungan Anda." />}
    </div>
  );
}
