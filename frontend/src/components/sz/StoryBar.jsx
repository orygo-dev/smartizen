import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Play, ChevronRight } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StoryComposer } from "@/components/sz/StoryComposer";
import { StoryViewer } from "@/components/sz/StoryViewer";
import { cn } from "@/lib/utils";

const MAX_INLINE = 8;

export function StoryRing({ g, me, onOpen, size = "h-16 w-16" }) {
  return (
    <button onClick={() => onOpen(g)} data-testid={`story-${g.author_id}`} className="flex shrink-0 flex-col items-center gap-1.5">
      <div className={cn("relative rounded-full p-[2px]", g.all_seen ? "bg-slate-300 dark:bg-slate-700" : "bg-gradient-to-tr from-sky-500 to-teal-500")}>
        <Avatar className={cn(size, "border-2 border-white dark:border-slate-900")}><AvatarFallback className="bg-slate-100 font-bold text-slate-500">{(g.author_name || "W")[0]}</AvatarFallback></Avatar>
        {g.has_video && <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-white ring-2 ring-white dark:ring-slate-900"><Play className="h-2.5 w-2.5 fill-white" /></span>}
      </div>
      <span className="max-w-[64px] truncate text-[11px] text-slate-500">{g.author_id === me ? "Anda" : g.author_name}</span>
    </button>
  );
}

export function StoryBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, reload } = useApi("/social/stories", []);
  const [create, setCreate] = useState(false);
  const [viewer, setViewer] = useState(null);
  const groups = data || [];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto sz-scroll-x pb-1" data-testid="story-bar">
        <button onClick={() => setCreate(true)} data-testid="story-add" className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-sky-300 text-sky-500"><Plus className="h-6 w-6" /></div>
          <span className="text-[11px] text-slate-500">Story Anda</span>
        </button>
        {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />)
          : groups.slice(0, MAX_INLINE).map((g) => <StoryRing key={g.author_id} g={g} me={user?.id} onOpen={setViewer} />)}
        {!loading && groups.length > 0 && (
          <button onClick={() => navigate("/app/stories")} data-testid="story-show-all" className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><ChevronRight className="h-6 w-6" /></div>
            <span className="text-[11px] font-semibold text-sky-600">Tampilkan Semua</span>
          </button>
        )}
      </div>
      <StoryComposer open={create} onOpenChange={setCreate} onCreated={reload} />
      {viewer && <StoryViewer group={viewer} onClose={() => { setViewer(null); reload(); }} />}
    </>
  );
}
