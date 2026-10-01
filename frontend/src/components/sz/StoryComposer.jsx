import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ImagePlus, Video, Type } from "lucide-react";
import { api, uploadFile, formatApiError, mediaUrl } from "@/lib/api";
import { MAX_VIDEO_MB } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PrivacyPicker } from "@/components/sz/PrivacyPicker";
import { MusicPicker } from "@/components/sz/MusicPicker";
import { cn } from "@/lib/utils";

const BG = ["#0369A1", "#0D9488", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#7C3AED"];

function Preview({ media, text, bg }) {
  return (
    <div className="grid aspect-[9/12] max-h-64 w-full place-items-center overflow-hidden rounded-xl text-white" style={{ background: media ? "#000" : bg }} data-testid="story-preview">
      {media?.type === "video" ? <video src={mediaUrl(media.url)} className="h-full w-full object-contain" muted autoPlay loop playsInline />
        : media ? <img src={mediaUrl(media.url)} alt="pratinjau" className="h-full w-full object-contain" />
        : <p className="px-6 text-center text-lg font-semibold">{text || "Tulis sesuatu..."}</p>}
    </div>
  );
}

export function StoryComposer({ open, onOpenChange, onCreated }) {
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BG[0]);
  const [media, setMedia] = useState(null);
  const [music, setMusic] = useState(null);
  const [privacy, setPrivacy] = useState("RT");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setText(""); setMedia(null); setMusic(null); setPrivacy("RT"); };

  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    if (isVideo && f.size > MAX_VIDEO_MB * 1024 * 1024) return toast.error(`Video maksimum ${MAX_VIDEO_MB} MB.`);
    if (!isVideo && f.size > 10 * 1024 * 1024) return toast.error("Foto maksimum 10 MB.");
    setUploading(true);
    try { const d = await uploadFile(f); setMedia({ url: d.url, type: isVideo ? "video" : "photo" }); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!text.trim() && !media) return toast.error("Isi teks atau unggah foto/video.");
    setSaving(true);
    try {
      await api.post("/social/stories", { media_type: media?.type || "text", text, media_url: media?.url || null, background: bg, music, privacy });
      toast.success("Story dibagikan!"); reset(); onOpenChange(false); onCreated?.();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" data-testid="story-composer">
        <DialogHeader><DialogTitle>Buat Story</DialogTitle></DialogHeader>
        <Preview media={media} text={text} bg={bg} />
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImagePlus className="h-4 w-4" /><Video className="h-4 w-4" /></>} Foto / Video
            <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} disabled={uploading} data-testid="story-media-input" />
          </label>
          {media && <Button variant="outline" onClick={() => setMedia(null)} className="rounded-full" data-testid="story-media-clear"><Type className="mr-1 h-4 w-4" /> Teks saja</Button>}
        </div>
        <Textarea data-testid="story-text-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={media ? "Tulis keterangan..." : "Tulis teks story..."} className="rounded-xl" maxLength={500} />
        {!media && <div className="flex gap-2">{BG.map((c) => <button key={c} onClick={() => setBg(c)} className={cn("h-7 w-7 rounded-full", bg === c && "ring-2 ring-slate-400 ring-offset-2")} style={{ background: c }} aria-label={`Warna ${c}`} />)}</div>}
        <MusicPicker value={music} onChange={setMusic} testPrefix="story-music" />
        <PrivacyPicker value={privacy} onChange={setPrivacy} testPrefix="story-privacy" />
        <DialogFooter><Button onClick={submit} disabled={saving || uploading} data-testid="story-submit-button" className="rounded-full sz-gradient text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bagikan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
