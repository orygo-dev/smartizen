import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Share2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ReelShareDialog({ reel, open, onOpenChange }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try { await api.post(`/reels/${reel.id}/share`, { text }); toast.success("Reel dibagikan ke Feed RT."); setText(""); onOpenChange(false); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl" data-testid="reel-share-dialog">
        <DialogHeader>
          <DialogTitle>Bagikan ke Feed RT</DialogTitle>
          <DialogDescription>Reel dari {reel.is_mine ? "Anda" : reel.author_name} akan tampil di Feed Warga RT Anda. Warga yang tidak memiliki akses ke reel ini tidak akan melihat videonya.</DialogDescription>
        </DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Tambahkan pesan (opsional)..." className="rounded-xl" data-testid="reel-share-text" />
        <DialogFooter>
          <Button onClick={share} disabled={busy} className="rounded-full sz-gradient text-white" data-testid="reel-share-submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Share2 className="mr-1.5 h-4 w-4" /> Bagikan</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
