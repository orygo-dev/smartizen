import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Eye, Loader2, Send, Music2, Trash2, Lock } from "lucide-react";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { PRIVACY_LABEL } from "@/lib/content";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function StoryMedia({ s, onEnded }) {
  if (s.media_type === "video")
    return <video key={s.id} src={mediaUrl(s.media_url)} autoPlay playsInline muted={!!s.music} onEnded={onEnded} className="max-h-[82vh] w-full object-contain" data-testid="story-video" />;
  if (s.media_url) return <img src={mediaUrl(s.media_url)} alt="story" className="max-h-[82vh] w-full object-contain" />;
  return <p className="px-8 text-center text-2xl font-bold text-white">{s.text}</p>;
}

function ReplyBar({ group, story }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.post("/chat/reply-story", { story_id: story.id, text: reply, client_message_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
      setReply(""); toast.success(`Balasan terkirim ke ${group.author_name || "warga"}.`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="absolute bottom-5 left-0 right-0 z-10 mx-auto flex max-w-md items-center gap-2 px-4" onClick={(e) => e.stopPropagation()}>
      <Input data-testid="story-reply-input" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder={`Balas story ${group.author_name || ""}...`} className="rounded-full border-white/40 bg-white/15 text-white placeholder:text-white/60 focus-visible:ring-white/50" />
      <Button onClick={send} disabled={busy || !reply.trim()} data-testid="story-reply-send" className="shrink-0 rounded-full sz-gradient text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
    </div>
  );
}

export function StoryViewer({ group, onClose }) {
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const s = group.items[idx];
  const mine = group.author_id === user?.id;
  const next = () => (idx + 1 < group.items.length ? setIdx(idx + 1) : onClose());

  useEffect(() => {
    api.post(`/social/stories/${s.id}/view`).catch(() => {});
    if (s.media_type === "video") return undefined;
    const t = setTimeout(next, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const remove = async (e) => {
    e.stopPropagation();
    try { await api.delete(`/social/stories/${s.id}`); toast.success("Story dihapus."); onClose(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" data-testid="story-viewer" onClick={next}>
      {s.music && <audio key={s.id} src={mediaUrl(s.music.url)} autoPlay loop data-testid="story-music-audio" />}
      <div className="absolute left-0 right-0 top-2 z-10 flex gap-1 px-3">
        {group.items.map((_, i) => <div key={i} className={cn("h-1 flex-1 rounded-full", i <= idx ? "bg-white" : "bg-white/30")} />)}
      </div>
      <div className="absolute left-4 right-14 top-6 z-10 flex items-center gap-2 text-white">
        <Avatar className="h-8 w-8"><AvatarFallback className="bg-white/20 text-white">{(group.author_name || "W")[0]}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.author_name}</p>
          <p className="flex items-center gap-2 text-[11px] text-white/70">
            <span className="flex items-center gap-0.5"><Lock className="h-3 w-3" /> {PRIVACY_LABEL[s.privacy] || "Warga RT Saya"}</span>
            {s.music && <span className="flex items-center gap-0.5 truncate" data-testid="story-music-label"><Music2 className="h-3 w-3" /> {s.music.title}</span>}
          </p>
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute right-4 top-6 z-10 text-white" data-testid="story-viewer-close"><X className="h-7 w-7" /></button>
      <div className="flex h-full w-full max-w-md flex-col items-center justify-center" style={{ background: s.media_url ? "#000" : s.background }}>
        <StoryMedia s={s} onEnded={next} />
        {s.media_url && s.text && <p className="mt-3 px-6 text-center text-sm text-white/90">{s.text}</p>}
      </div>
      {mine ? (
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-5 text-sm text-white/80">
          <span className="flex items-center"><Eye className="mr-1.5 h-4 w-4" /> {s.viewer_count} dilihat</span>
          <button onClick={remove} className="flex items-center text-rose-300" data-testid="story-delete"><Trash2 className="mr-1 h-4 w-4" /> Hapus</button>
        </div>
      ) : <ReplyBar group={group} story={s} />}
    </div>
  );
}
