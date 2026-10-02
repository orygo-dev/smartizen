import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, Trash2, MessageCircle } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { fmtDateTime } from "@/lib/labels";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ReelComments({ reelId, open, onOpenChange, onCount }) {
  const { data, loading, setData } = useApi(open ? `/reels/${reelId}/comments` : null, [open, reelId]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data: c } = await api.post(`/reels/${reelId}/comments`, { text });
      setData((d) => [...(d || []), c]); setText(""); onCount(1);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { await api.delete(`/reels/${reelId}/comments/${id}`); setData((d) => d.filter((c) => c.id !== id)); onCount(-1); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[75vh] max-w-2xl flex-col rounded-t-2xl" data-testid="reel-comments-sheet">
        <SheetHeader><SheetTitle>Komentar</SheetTitle><SheetDescription>Diskusi warga tentang reel ini</SheetDescription></SheetHeader>
        <div className="min-h-[120px] flex-1 space-y-3 overflow-y-auto py-3" data-testid="reel-comments-list">
          {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /> : !data?.length ? (
            <p className="flex flex-col items-center gap-1 py-6 text-sm text-slate-400" data-testid="reel-comments-empty"><MessageCircle className="h-6 w-6" /> Belum ada komentar. Jadilah yang pertama!</p>
          ) : data.map((c) => (
            <div key={c.id} className="flex gap-2.5" data-testid={`reel-comment-${c.id}`}>
              <Avatar className="h-8 w-8"><AvatarFallback className="bg-sky-100 text-xs text-sky-700">{(c.author_name || "W")[0]}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs"><span className="font-semibold text-slate-800 dark:text-slate-100">{c.author_name || "Warga"}</span> <span className="text-slate-400">{fmtDateTime(c.created_at)}</span></p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{c.text}</p>
              </div>
              {c.can_delete && <button onClick={() => remove(c.id)} className="self-start text-slate-400 hover:text-rose-500" data-testid={`reel-comment-delete-${c.id}`} aria-label="Hapus komentar"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={500} placeholder="Tulis komentar..." className="rounded-full" data-testid="reel-comment-input" />
          <Button onClick={send} disabled={busy || !text.trim()} className="shrink-0 rounded-full sz-gradient text-white" data-testid="reel-comment-send">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
