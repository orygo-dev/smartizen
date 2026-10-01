import { useState } from "react";
import { Clapperboard, Plus } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Loading, EmptyState } from "@/components/sz/States";
import { Button } from "@/components/ui/button";
import { ReelItem } from "@/components/sz/ReelItem";
import { ReelComposer } from "@/components/sz/ReelComposer";

export default function Reels() {
  const { data, loading, reload, setData } = useApi("/reels", []);
  const [create, setCreate] = useState(false);
  const [muted, setMuted] = useState(true);

  return (
    <div className="-mx-4 -my-5" data-testid="reels-page">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Reels</h1>
          <p className="text-xs text-slate-500">Video singkat dari warga sekitar</p>
        </div>
        <Button onClick={() => setCreate(true)} className="rounded-full sz-gradient text-white" data-testid="reels-upload-button"><Plus className="mr-1 h-4 w-4" /> Unggah</Button>
      </div>
      {loading ? <div className="px-4"><Loading /></div> : !data?.length ? (
        <div className="px-4"><EmptyState icon={Clapperboard} title="Belum ada reel" description="Jadilah yang pertama membagikan video singkat kegiatan di lingkungan Anda." actionLabel="Unggah Reel" onAction={() => setCreate(true)} testId="reels-empty" /></div>
      ) : (
        <div className="h-[calc(100dvh-12rem)] snap-y snap-mandatory overflow-y-scroll sm:mx-auto sm:max-w-sm sm:rounded-2xl" data-testid="reels-feed">
          {data.map((r) => <ReelItem key={r.id} reel={r} muted={muted} onToggleMute={() => setMuted((m) => !m)} onDeleted={(id) => setData((d) => d.filter((x) => x.id !== id))} />)}
        </div>
      )}
      <ReelComposer open={create} onOpenChange={setCreate} onCreated={reload} />
    </div>
  );
}
