import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Video } from "lucide-react";
import { api, uploadFile, formatApiError, mediaUrl } from "@/lib/api";
import { MAX_VIDEO_MB } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PrivacyPicker } from "@/components/sz/PrivacyPicker";
import { MusicPicker } from "@/components/sz/MusicPicker";

export function ReelComposer({ open, onOpenChange, onCreated }) {
  const [video, setVideo] = useState(null);
  const [caption, setCaption] = useState("");
  const [music, setMusic] = useState(null);
  const [privacy, setPrivacy] = useState("RT");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast.error("Pilih berkas video.");
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) return toast.error(`Video maksimum ${MAX_VIDEO_MB} MB.`);
    setUploading(true);
    try { const d = await uploadFile(f); setVideo(d.url); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!video) return toast.error("Unggah video terlebih dahulu.");
    setSaving(true);
    try {
      await api.post("/reels", { media_url: video, caption, music, privacy });
      toast.success("Reel diunggah!"); setVideo(null); setCaption(""); setMusic(null); setPrivacy("RT");
      onOpenChange(false); onCreated?.();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" data-testid="reel-composer">
        <DialogHeader><DialogTitle>Unggah Reel</DialogTitle></DialogHeader>
        <label className="relative grid aspect-[9/14] max-h-72 w-full cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          {video ? <video src={mediaUrl(video)} className="h-full w-full bg-black object-contain" muted autoPlay loop playsInline data-testid="reel-preview" />
            : <span className="flex flex-col items-center gap-2 text-sm text-slate-500">{uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Video className="h-7 w-7" />}{uploading ? "Mengunggah..." : `Pilih video vertikal (maks. ${MAX_VIDEO_MB} MB)`}</span>}
          <input type="file" accept="video/*" className="hidden" onChange={onFile} disabled={uploading} data-testid="reel-video-input" />
        </label>
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Tulis keterangan reel..." maxLength={300} className="rounded-xl" data-testid="reel-caption-input" />
        <MusicPicker value={music} onChange={setMusic} testPrefix="reel-music" />
        <PrivacyPicker value={privacy} onChange={setPrivacy} testPrefix="reel-privacy" />
        <DialogFooter><Button onClick={submit} disabled={saving || uploading || !video} className="rounded-full sz-gradient text-white" data-testid="reel-submit-button">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bagikan Reel"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
