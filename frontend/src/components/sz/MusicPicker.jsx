import { useRef, useState } from "react";
import { toast } from "sonner";
import { Music2, Play, Pause, Upload, Loader2, X } from "lucide-react";
import { uploadFile, formatApiError, mediaUrl } from "@/lib/api";
import { MUSIC_LIBRARY } from "@/lib/content";
import { cn } from "@/lib/utils";

export function MusicPicker({ value, onChange, testPrefix = "music" }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(null);
  const [uploading, setUploading] = useState(false);

  const preview = (t) => {
    if (playing === t.url) { audio.current.pause(); setPlaying(null); return; }
    audio.current.src = mediaUrl(t.url); audio.current.play().catch(() => {}); setPlaying(t.url);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Musik maksimum 10 MB.");
    setUploading(true);
    try { const d = await uploadFile(f); onChange({ title: f.name.replace(/\.[^.]+$/, "").slice(0, 60), url: d.url }); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const tracks = value && !MUSIC_LIBRARY.some((t) => t.url === value.url) ? [...MUSIC_LIBRARY, value] : MUSIC_LIBRARY;

  return (
    <div>
      <audio ref={audio} onEnded={() => setPlaying(null)} />
      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500"><Music2 className="h-3.5 w-3.5" /> Musik latar</p>
      <div className="flex gap-2 overflow-x-auto pb-1 sz-scroll-x">
        <button type="button" onClick={() => onChange(null)} data-testid={`${testPrefix}-none`}
          className={cn("flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium", !value ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10" : "border-slate-200 text-slate-500 dark:border-slate-700")}>
          <X className="h-3 w-3" /> Tanpa musik
        </button>
        {tracks.map((t) => (
          <div key={t.url} className={cn("flex shrink-0 items-center rounded-full border text-xs font-medium", value?.url === t.url ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            <button type="button" onClick={() => preview(t)} className="grid h-7 w-7 place-items-center" aria-label="Putar pratinjau">{playing === t.url ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</button>
            <button type="button" onClick={() => onChange(t)} data-testid={`${testPrefix}-${t.url.split("/").pop().split(".")[0]}`} className="py-1.5 pr-3">{t.title}</button>
          </div>
        ))}
        <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Unggah
          <input type="file" accept="audio/*" className="hidden" onChange={onFile} data-testid={`${testPrefix}-upload`} />
        </label>
      </div>
    </div>
  );
}
