import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Heart, Music2, Volume2, VolumeX, Trash2, Lock, Eye, MessageCircle, Share2 } from "lucide-react";
import { ReelComments } from "@/components/sz/ReelComments";
import { ReelShareDialog } from "@/components/sz/ReelShareDialog";
import { api, formatApiError, mediaUrl } from "@/lib/api";
import { PRIVACY_LABEL } from "@/lib/content";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ReelItem({ reel, muted, onToggleMute, onDeleted }) {
  const box = useRef(null);
  const vid = useRef(null);
  const aud = useRef(null);
  const [active, setActive] = useState(false);
  const [liked, setLiked] = useState(reel.liked_by_me);
  const [likes, setLikes] = useState(reel.like_count);
  const [comments, setComments] = useState(reel.comment_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const els = [vid.current, aud.current].filter(Boolean);
    if (active) {
      els.forEach((el) => el.play().catch(() => {}));
      if (!viewed.current) { viewed.current = true; api.post(`/reels/${reel.id}/view`).catch(() => {}); }
    } else els.forEach((el) => el.pause());
  }, [active, reel.id]);

  const like = async () => {
    try { const { data } = await api.post(`/reels/${reel.id}/like`); setLiked(data.liked); setLikes(data.like_count); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const remove = async () => {
    try { await api.delete(`/reels/${reel.id}`); toast.success("Reel dihapus."); onDeleted(reel.id); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div ref={box} className="relative h-full w-full snap-start snap-always overflow-hidden bg-black" data-testid={`reel-${reel.id}`}>
      <video ref={vid} src={mediaUrl(reel.media_url)} loop playsInline muted={muted || !!reel.music} onClick={onToggleMute} className="h-full w-full object-contain" data-testid="reel-video" />
      {reel.music && <audio ref={aud} src={mediaUrl(reel.music.url)} loop muted={muted} />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      <button onClick={onToggleMute} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white" data-testid="reel-mute-toggle">
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 text-white">
        <button onClick={like} className="flex flex-col items-center gap-0.5" data-testid={`reel-like-${reel.id}`}>
          <Heart className={cn("h-7 w-7 transition-transform active:scale-125", liked && "fill-rose-500 text-rose-500")} />
          <span className="text-xs font-semibold" data-testid={`reel-like-count-${reel.id}`}>{likes}</span>
        </button>
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5" data-testid={`reel-comments-${reel.id}`}>
          <MessageCircle className="h-7 w-7" /><span className="text-xs font-semibold" data-testid={`reel-comment-count-${reel.id}`}>{comments}</span>
        </button>
        <button onClick={() => setShowShare(true)} className="flex flex-col items-center gap-0.5" data-testid={`reel-share-${reel.id}`}>
          <Share2 className="h-6 w-6" /><span className="text-[10px] font-semibold">Bagikan</span>
        </button>
        <span className="flex flex-col items-center gap-0.5 text-xs"><Eye className="h-6 w-6" />{reel.view_count}</span>
        {reel.is_mine && <button onClick={remove} data-testid={`reel-delete-${reel.id}`}><Trash2 className="h-6 w-6 text-rose-300" /></button>}
      </div>
      <div className="absolute bottom-5 left-4 right-16 text-white">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-white/50"><AvatarFallback className="bg-white/20 text-xs text-white">{(reel.author_name || "W")[0]}</AvatarFallback></Avatar>
          <span className="text-sm font-bold">{reel.is_mine ? "Anda" : reel.author_name}</span>
          <span className="flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px]"><Lock className="h-2.5 w-2.5" /> {PRIVACY_LABEL[reel.privacy]}</span>
        </div>
        {reel.caption && <p className="mt-2 line-clamp-2 text-sm text-white/90">{reel.caption}</p>}
        {reel.music && <p className="mt-1.5 flex items-center gap-1 text-xs text-white/80"><Music2 className="h-3 w-3" /> {reel.music.title}</p>}
      </div>
      <ReelComments reelId={reel.id} open={showComments} onOpenChange={setShowComments} onCount={(n) => setComments((c) => Math.max(0, c + n))} />
      <ReelShareDialog reel={reel} open={showShare} onOpenChange={setShowShare} />
    </div>
  );
}
