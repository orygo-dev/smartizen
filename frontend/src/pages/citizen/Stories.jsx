import { useState } from "react";
import { Plus, Play, Music2, CircleDashed } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { mediaUrl } from "@/lib/api";
import { PRIVACY_LABEL } from "@/lib/content";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { Button } from "@/components/ui/button";
import { StoryComposer } from "@/components/sz/StoryComposer";
import { StoryViewer } from "@/components/sz/StoryViewer";
import { cn } from "@/lib/utils";

function Cover({ s }) {
  if (s.media_type === "video") return <video src={`${mediaUrl(s.media_url)}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />;
  if (s.media_url) return <img src={mediaUrl(s.media_url)} alt="" className="h-full w-full object-cover" />;
  return <div className="grid h-full w-full place-items-center p-3 text-center text-sm font-bold text-white" style={{ background: s.background }}><span className="line-clamp-4">{s.text}</span></div>;
}

export default function Stories() {
  const { user } = useAuth();
  const { data, loading, reload } = useApi("/social/stories", []);
  const [create, setCreate] = useState(false);
  const [viewer, setViewer] = useState(null);

  return (
    <div>
      <PageHeader title="Semua Story" subtitle="Story 24 jam dari warga di sekitar Anda" testId="stories-page"
        action={<Button onClick={() => setCreate(true)} className="rounded-full sz-gradient text-white" data-testid="stories-create"><Plus className="mr-1 h-4 w-4" /> Buat Story</Button>} />
      {loading ? <Loading /> : !data?.length ? (
        <EmptyState icon={CircleDashed} title="Belum ada story" description="Bagikan momen di lingkungan Anda — story hilang otomatis setelah 24 jam." actionLabel="Buat Story" onAction={() => setCreate(true)} />
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {data.map((g) => {
            const last = g.items[g.items.length - 1];
            return (
              <button key={g.author_id} onClick={() => setViewer(g)} data-testid={`stories-card-${g.author_id}`}
                className={cn("group relative aspect-[9/14] overflow-hidden rounded-2xl bg-slate-900 text-left ring-2 transition-transform active:scale-95", g.all_seen ? "ring-slate-200 dark:ring-slate-800" : "ring-sky-500")}>
                <Cover s={last} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />
                <div className="absolute left-2 top-2 flex gap-1">
                  {g.has_video && <span className="grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><Play className="h-2.5 w-2.5 fill-white" /></span>}
                  {g.items.some((i) => i.music) && <span className="grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><Music2 className="h-2.5 w-2.5" /></span>}
                </div>
                <div className="absolute inset-x-2 bottom-2 text-white">
                  <p className="truncate text-xs font-bold">{g.author_id === user?.id ? "Story Anda" : g.author_name}</p>
                  <p className="truncate text-[10px] text-white/70">{g.items.length} story · {PRIVACY_LABEL[last.privacy]}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <StoryComposer open={create} onOpenChange={setCreate} onCreated={reload} />
      {viewer && <StoryViewer group={viewer} onClose={() => { setViewer(null); reload(); }} />}
    </div>
  );
}
