import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { Send, ArrowLeft, ShieldCheck, MessageCircle, Loader2, ImagePlus, Mic, Square, X, Check, CheckCheck, MoreVertical, Pencil, Trash2, Search, Ban, Flag, ShieldAlert } from "lucide-react";
import { api, formatApiError, uploadFile, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/sz/PageHeader";
import { Loading, EmptyState } from "@/components/sz/States";
import { fmtDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

function Receipt({ read }) {
  return read
    ? <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
    : <Check className="h-3.5 w-3.5 text-white/70" />;
}

function MessageBubble({ m, mine, peerId, onEdit, onDelete }) {
  const read = mine && Array.isArray(m.read_by) && peerId && m.read_by.includes(peerId);
  if (m.deleted) {
    return (
      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm italic text-slate-400", mine ? "bg-slate-200 dark:bg-slate-800" : "bg-white dark:bg-slate-800")}>
          Pesan ini dihapus
        </div>
      </div>
    );
  }
  return (
    <div className={cn("group flex items-center gap-1", mine ? "justify-end" : "justify-start")}>
      {mine && m.kind === "text" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 transition group-hover:opacity-100" data-testid={`msg-menu-${m.id}`}><MoreVertical className="h-4 w-4 text-slate-400" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(m)} data-testid="msg-edit"><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(m)} className="text-rose-600" data-testid="msg-delete"><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {mine && m.kind !== "text" && (
        <button onClick={() => onDelete(m)} className="opacity-0 transition group-hover:opacity-100" data-testid={`msg-menu-${m.id}`}><Trash2 className="h-4 w-4 text-slate-400" /></button>
      )}
      <div className={cn("max-w-[78%] overflow-hidden rounded-2xl px-3.5 py-2 text-sm", mine ? "sz-gradient text-white" : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>
        {m.kind === "story_reply" && m.reply_to_story && (
          <div className={cn("mb-1.5 flex items-center gap-2 rounded-lg p-1.5", mine ? "bg-white/15" : "bg-slate-100 dark:bg-slate-700/60")}>
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md text-[9px] font-bold text-white" style={{ background: m.reply_to_story.background || "#0060F0" }}>
              {m.reply_to_story.preview_media ? <img src={mediaUrl(m.reply_to_story.preview_media)} alt="" className="h-full w-full object-cover" /> : (m.reply_to_story.preview_text || "Story").slice(0, 10)}
            </div>
            <div className={cn("min-w-0 text-[11px]", mine ? "text-white/80" : "text-slate-500")}>
              <p className="font-semibold">Membalas story</p>
              <p className="truncate">{m.reply_to_story.preview_text || "Foto"}</p>
            </div>
          </div>
        )}
        {m.kind === "image" && m.media_url && <img src={mediaUrl(m.media_url)} alt="foto" className="mb-1 max-h-72 w-full rounded-lg object-cover" />}
        {m.kind === "audio" && m.media_url && <audio controls src={mediaUrl(m.media_url)} className="my-1 h-10 w-56 max-w-full" />}
        {m.text ? <div className="whitespace-pre-wrap break-words">{m.text}</div> : null}
        <div className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/70" : "text-slate-400")}>
          {m.edited_at && <span className="italic">diedit</span>}
          <span>{fmtDateTime(m.created_at).split(",").pop()}</span>
          {mine && <Receipt read={read} />}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const { data: convs, loading, reload } = useApi("/chat/conversations", []);
  const location = useLocation();
  const [active, setActive] = useState(location.state?.open || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [iBlocked, setIBlocked] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const revRef = useRef(0);
  const typingSentRef = useRef(0);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null);

  const mergeMessages = (incoming) => {
    if (!incoming?.length) return;
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return Array.from(map.values()).sort((a, b) => a.seq - b.seq);
    });
  };

  const poll = useCallback(async () => {
    if (!active) return;
    try {
      const { data } = await api.get(`/chat/conversations/${active.id}/messages`, { params: { rev_after: revRef.current } });
      if (data.server_rev && data.server_rev > revRef.current) revRef.current = data.server_rev;
      mergeMessages(data.messages);
      setPeerTyping(!!data.peer_typing);
      setPeerOnline(!!data.peer_online);
      setIBlocked(!!data.i_blocked_peer);
    } catch { /* transient poll error ignored */ }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    setMessages([]); revRef.current = 0;
    poll();
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [active, poll]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, peerTyping]);

  const startRT = async () => {
    try { const { data } = await api.post("/chat/with-rt"); setActive({ id: data.id, peer: data.peer }); reload(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const pushMessage = (m) => { if (m?.rev && m.rev > revRef.current) revRef.current = m.rev; mergeMessages([m]); };

  const notifyTyping = () => {
    const now = Date.now();
    if (now - typingSentRef.current > 3000) {
      typingSentRef.current = now;
      api.post(`/chat/conversations/${active.id}/typing`).catch(() => {});
    }
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    if (editing) return saveEdit();
    const body = text; setText(""); setSending(true);
    const cmid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { data } = await api.post(`/chat/conversations/${active.id}/messages`, { text: body, kind: "text", client_message_id: cmid });
      pushMessage(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); setText(body); }
    finally { setSending(false); }
  };

  const sendMedia = async (kind, url, duration) => {
    if (!active) return;
    const cmid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { data } = await api.post(`/chat/conversations/${active.id}/messages`, { text: "", kind, media_url: url, duration, client_message_id: cmid });
      pushMessage(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Foto terlalu besar (maksimum 15 MB).");
    setUploading(true);
    try { const up = await uploadFile(file); await sendMedia("image", up.url); }
    catch { toast.error("Gagal mengunggah foto."); }
    finally { setUploading(false); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const secs = Math.max(1, Math.round((Date.now() - recRef.current.start) / 1000));
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setUploading(true);
        try {
          const ext = (mr.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
          const up = await uploadFile(blob, `voice-${Date.now()}.${ext}`);
          await sendMedia("audio", up.url, secs);
        } catch { toast.error("Gagal mengunggah pesan suara."); }
        finally { setUploading(false); }
      };
      mr.start();
      recRef.current = { mr, start: Date.now(), timer: setInterval(() => setRecSecs((s) => s + 1), 1000) };
      setRecSecs(0); setRecording(true);
    } catch { toast.error("Mikrofon tidak dapat diakses. Izinkan akses mikrofon."); }
  };

  const stopRec = (cancel = false) => {
    const r = recRef.current; if (!r) return;
    clearInterval(r.timer);
    if (cancel) r.mr.onstop = () => r.mr.stream?.getTracks().forEach((t) => t.stop());
    try { r.mr.stop(); } catch { /* recorder already stopped */ }
    recRef.current = null; setRecording(false); setRecSecs(0);
  };

  const beginEdit = (m) => { setEditing(m); setText(m.text); };
  const cancelEdit = () => { setEditing(null); setText(""); };
  const saveEdit = async () => {
    const body = text.trim(); if (!body) return;
    try {
      await api.patch(`/chat/conversations/${active.id}/messages/${editing.id}`, { text: body });
      setMessages((prev) => prev.map((x) => x.id === editing.id ? { ...x, text: body, edited_at: new Date().toISOString() } : x));
      cancelEdit();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    const m = confirmDel; setConfirmDel(null);
    try {
      await api.delete(`/chat/conversations/${active.id}/messages/${m.id}`);
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, deleted: true, text: "", media_url: null } : x));
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const runSearch = async (q) => {
    setSearchQ(q);
    if (!q.trim()) return setSearchRes([]);
    try { const { data } = await api.get(`/chat/conversations/${active.id}/search`, { params: { q } }); setSearchRes(data); }
    catch { setSearchRes([]); }
  };

  const toggleBlock = async () => {
    try {
      if (iBlocked) { await api.post("/chat/unblock", { user_id: active.peer.user_id }); setIBlocked(false); toast.success("Blokir dibatalkan."); }
      else { await api.post("/chat/block", { user_id: active.peer.user_id }); setIBlocked(true); toast.success(`${active.peer.name} diblokir.`); }
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const reportUser = async () => {
    try { await api.post("/chat/report", { user_id: active.peer.user_id, reason: "Dilaporkan dari percakapan" }); toast.success("Laporan terkirim ke moderator."); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (active) {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col">
        <div className="mb-3 flex items-center gap-3">
          <button onClick={() => { setActive(null); reload(); }} data-testid="chat-back"><ArrowLeft className="h-5 w-5 text-slate-500" /></button>
          <div className="relative">
            <Avatar className="h-9 w-9"><AvatarFallback className="bg-sky-100 font-bold text-sky-700">{(active.peer?.name || "?")[0]}</AvatarFallback></Avatar>
            {peerOnline && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">{active.peer?.name}{active.peer?.is_rt && <ShieldCheck className="h-4 w-4 text-emerald-500" />}</p>
            <p className="text-xs text-slate-400">{peerTyping ? <span className="text-sky-500">sedang mengetik...</span> : peerOnline ? "Online" : (active.peer?.is_rt ? "Pengurus RT" : "Warga")}</p>
          </div>
          <button onClick={() => setShowSearch((v) => !v)} data-testid="chat-search-toggle" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Search className="h-5 w-5" /></button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button data-testid="chat-more" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><MoreVertical className="h-5 w-5" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleBlock} data-testid="chat-block">{iBlocked ? <><ShieldAlert className="mr-2 h-4 w-4" /> Batalkan Blokir</> : <><Ban className="mr-2 h-4 w-4" /> Blokir</>}</DropdownMenuItem>
              <DropdownMenuItem onClick={reportUser} className="text-rose-600" data-testid="chat-report"><Flag className="mr-2 h-4 w-4" /> Laporkan</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showSearch && (
          <div className="mb-2">
            <Input autoFocus value={searchQ} onChange={(e) => runSearch(e.target.value)} placeholder="Cari di percakapan ini..." data-testid="chat-search-input" className="rounded-full" />
            {searchQ && <p className="mt-1 px-1 text-xs text-slate-400">{searchRes.length} hasil ditemukan</p>}
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-900/40">
          {(showSearch && searchQ ? searchRes : messages).map((m) => (
            <MessageBubble key={m.id} m={m} mine={m.sender_id === user?.id} peerId={active.peer?.user_id} onEdit={beginEdit} onDelete={setConfirmDel} />
          ))}
          {peerTyping && !showSearch && (
            <div className="flex justify-start"><div className="rounded-2xl bg-white px-4 py-2.5 dark:bg-slate-800"><span className="flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.15s" }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.3s" }} /></span></div></div>
          )}
          <div ref={bottomRef} />
        </div>

        {iBlocked ? (
          <div className="mt-3 rounded-full bg-slate-100 px-4 py-2.5 text-center text-sm text-slate-500 dark:bg-slate-800">Anda memblokir pengguna ini. <button onClick={toggleBlock} className="font-semibold text-sky-600">Batalkan</button></div>
        ) : recording ? (
          <div className="mt-3 flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 dark:border-rose-500/30 dark:bg-rose-500/10">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
            <span className="flex-1 text-sm font-medium text-rose-600">Merekam... {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}</span>
            <button onClick={() => stopRec(true)} data-testid="chat-voice-cancel" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>
            <Button onClick={() => stopRec(false)} data-testid="chat-voice-stop" size="sm" className="rounded-full bg-rose-500 text-white hover:bg-rose-600"><Square className="mr-1 h-3.5 w-3.5" /> Kirim</Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            {editing ? (
              <button onClick={cancelEdit} data-testid="chat-edit-cancel" className="shrink-0 rounded-full p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} data-testid="chat-photo-input" />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="chat-photo-button" className="shrink-0 rounded-full p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}</button>
                <button onClick={startRec} disabled={uploading} data-testid="chat-voice-button" className="shrink-0 rounded-full p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><Mic className="h-5 w-5" /></button>
              </>
            )}
            <Input data-testid="chat-message-input" value={text} onChange={(e) => { setText(e.target.value); notifyTyping(); }} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={editing ? "Edit pesan..." : "Tulis pesan..."} className="rounded-full" />
            <Button onClick={send} disabled={sending} data-testid="chat-send-button" className="shrink-0 rounded-full sz-gradient text-white">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button>
          </div>
        )}

        <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Hapus pesan?</AlertDialogTitle><AlertDialogDescription>Pesan akan dihapus untuk semua orang dalam percakapan ini.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete} data-testid="msg-delete-confirm" className="bg-rose-600 hover:bg-rose-700">Hapus</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Chat" subtitle="Pesan dengan warga dan pengurus RT"
        action={<Button onClick={startRT} data-testid="chat-rt-button" className="rounded-full sz-gradient text-white"><ShieldCheck className="mr-1.5 h-4 w-4" /> Chat Pengurus RT</Button>} />
      {loading ? <Loading /> : convs?.length ? (
        <div className="space-y-2">
          {convs.map((c) => (
            <button key={c.id} onClick={() => setActive({ id: c.id, peer: c.peer })} data-testid={`conv-${c.id}`}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <Avatar className="h-11 w-11"><AvatarFallback className="bg-sky-100 font-bold text-sky-700">{(c.peer?.name || "?")[0]}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">{c.peer?.name}{c.peer?.is_rt && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}</p><p className="truncate text-sm text-slate-400">{c.last_message || "Mulai percakapan"}</p></div>
              {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky-500 px-1.5 text-xs font-bold text-white">{c.unread}</span>}
            </button>
          ))}
        </div>
      ) : <EmptyState icon={MessageCircle} title="Belum ada percakapan" description="Mulai chat dengan pengurus RT atau warga lain di lingkungan Anda." actionLabel="Chat Pengurus RT" onAction={startRT} />}
    </div>
  );
}
