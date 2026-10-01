from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import time
from bson import ObjectId
from core.db import db
from core.common import new_id, notify
from core.security import get_current_user, iso

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Ephemeral realtime state (single-worker uvicorn) — not persistent truth.
_typing: dict = {}    # {cid: {uid: ts}}
_presence: dict = {}  # {uid: ts}
EDIT_WINDOW_SECONDS = 15 * 60


def _touch_presence(uid):
    _presence[uid] = time.time()


def _is_online(uid):
    return (time.time() - _presence.get(uid, 0)) < 20


async def _is_blocked(a, b):
    doc = await db.chat_blocks.find_one({"$or": [
        {"blocker": a, "blocked": b}, {"blocker": b, "blocked": a}]})
    return bool(doc)


async def _profile(uid):
    return await db.social_profiles.find_one({"user_id": uid}, {"_id": 0})


async def _peer_info(uid):
    p = await _profile(uid)
    role = await db.role_assignments.find_one({"user_id": uid, "role": "RT_HEAD", "status": "ACTIVE"})
    return {"user_id": uid, "name": (p or {}).get("display_name") or "Pengguna",
            "username": (p or {}).get("username"), "is_rt": bool(role)}


async def _get_or_create(uid_a, uid_b):
    pair = sorted([uid_a, uid_b])
    conv = await db.conversations.find_one({"participants": pair})
    if not conv:
        conv = {"id": new_id(), "participants": pair, "last_message": None,
                "last_at": iso(), "created_at": iso()}
        await db.conversations.insert_one(conv)
    conv.pop("_id", None)
    return conv


class StartReq(BaseModel):
    peer_user_id: str


@router.post("/conversations")
async def start_conversation(req: StartReq, current=Depends(get_current_user)):
    if req.peer_user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat mengirim pesan ke diri sendiri.")
    peer = await db.users.find_one({"_id": ObjectId(req.peer_user_id)}) if len(req.peer_user_id) == 24 else None
    if not peer:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan.")
    if await _is_blocked(current["id"], req.peer_user_id):
        raise HTTPException(status_code=403, detail="Tidak dapat memulai percakapan karena pemblokiran.")
    conv = await _get_or_create(current["id"], req.peer_user_id)
    return {**conv, "peer": await _peer_info(req.peer_user_id)}


@router.post("/with-rt")
async def chat_with_rt(current=Depends(get_current_user)):
    mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True})
    if not mem:
        raise HTTPException(status_code=400, detail="Anda belum memilih wilayah RT.")
    head = await db.role_assignments.find_one({"role": "RT_HEAD", "scope_id": mem["rt_id"], "status": "ACTIVE"})
    if not head:
        raise HTTPException(status_code=404, detail="Ketua RT belum bergabung di Rakatin.")
    conv = await _get_or_create(current["id"], head["user_id"])
    return {**conv, "peer": await _peer_info(head["user_id"])}


@router.get("/conversations")
async def list_conversations(current=Depends(get_current_user)):
    rows = await db.conversations.find({"participants": current["id"]}, {"_id": 0}).sort("last_at", -1).to_list(200)
    out = []
    for c in rows:
        peer_id = [p for p in c["participants"] if p != current["id"]]
        peer_id = peer_id[0] if peer_id else current["id"]
        unread = await db.chat_messages.count_documents(
            {"conversation_id": c["id"], "sender_id": {"$ne": current["id"]}, "read_by": {"$ne": current["id"]}})
        out.append({**c, "peer": await _peer_info(peer_id), "unread": unread})
    return out


class MessageReq(BaseModel):
    text: str = ""
    client_message_id: str
    kind: str = "text"  # text | image | audio
    media_url: Optional[str] = None
    duration: Optional[float] = None  # seconds, for voice notes


def _preview(kind: str, text: str) -> str:
    if kind == "image":
        return "\U0001F4F7 Foto"
    if kind == "audio":
        return "\U0001F3A4 Pesan suara"
    if kind == "story_reply":
        return "\u21A9\uFE0F Balasan story"
    return (text or "")[:80]


@router.get("/conversations/{cid}/messages")
async def get_messages(cid: str, after: Optional[str] = Query(None),
                       rev_after: Optional[str] = Query(None), current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Akses percakapan ditolak.")
    _touch_presence(current["id"])
    peer_id = next((p for p in conv["participants"] if p != current["id"]), current["id"])

    # mark incoming as read (bumps rev so the sender sees read receipts)
    await db.chat_messages.update_many(
        {"conversation_id": cid, "sender_id": {"$ne": current["id"]}, "read_by": {"$ne": current["id"]}},
        [{"$set": {"read_by": {"$setUnion": ["$read_by", [current["id"]]]}, "rev": time.time()}}])

    # rev-based sync: return new AND changed messages (edits/deletes/read-receipts)
    if rev_after is not None:
        q = {"conversation_id": cid, "rev": {"$gt": float(rev_after)}}
    elif after is not None:
        q = {"conversation_id": cid, "seq": {"$gt": float(after)}}
    else:
        q = {"conversation_id": cid}
    msgs = await db.chat_messages.find(q, {"_id": 0}).sort("rev", 1).to_list(500)
    server_rev = max([m.get("rev", m["seq"]) for m in msgs], default=float(rev_after or 0))

    tset = _typing.get(cid, {})
    peer_typing = (time.time() - tset.get(peer_id, 0)) < 6
    return {"messages": msgs, "server_rev": server_rev, "peer_typing": peer_typing,
            "peer_online": _is_online(peer_id),
            "i_blocked_peer": bool(await db.chat_blocks.find_one({"blocker": current["id"], "blocked": peer_id}))}


@router.post("/conversations/{cid}/typing")
async def set_typing(cid: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Akses percakapan ditolak.")
    _typing.setdefault(cid, {})[current["id"]] = time.time()
    _touch_presence(current["id"])
    return {"ok": True}


@router.get("/conversations/{cid}/search")
async def search_messages(cid: str, q: str = Query(..., min_length=1), current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Akses percakapan ditolak.")
    import re
    rx = re.compile(re.escape(q), re.IGNORECASE)
    rows = await db.chat_messages.find(
        {"conversation_id": cid, "deleted": {"$ne": True}, "text": {"$regex": rx}},
        {"_id": 0}).sort("seq", -1).to_list(50)
    return rows


@router.post("/conversations/{cid}/messages")
async def send_message(cid: str, req: MessageReq, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Akses percakapan ditolak.")
    peer_id = next((p for p in conv["participants"] if p != current["id"]), current["id"])
    if await _is_blocked(current["id"], peer_id):
        raise HTTPException(status_code=403, detail="Tidak dapat mengirim pesan karena pemblokiran.")
    if req.kind == "text" and not (req.text or "").strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")
    if req.kind in ("image", "audio") and not req.media_url:
        raise HTTPException(status_code=400, detail="Lampiran media tidak ditemukan.")
    # idempotency via client_message_id
    existing = await db.chat_messages.find_one({"conversation_id": cid, "client_message_id": req.client_message_id}, {"_id": 0})
    if existing:
        return existing
    _touch_presence(current["id"])
    now = time.time()
    msg = {"id": new_id(), "conversation_id": cid, "sender_id": current["id"], "text": req.text,
           "kind": req.kind, "media_url": req.media_url, "duration": req.duration, "deleted": False,
           "edited_at": None, "client_message_id": req.client_message_id, "seq": now, "rev": now,
           "read_by": [current["id"]], "created_at": iso()}
    await db.chat_messages.insert_one(msg)
    _typing.get(cid, {}).pop(current["id"], None)
    await db.conversations.update_one({"id": cid}, {"$set": {"last_message": _preview(req.kind, req.text), "last_at": iso()}})
    msg.pop("_id", None)
    return msg


class EditReq(BaseModel):
    text: str


@router.patch("/conversations/{cid}/messages/{mid}")
async def edit_message(cid: str, mid: str, req: EditReq, current=Depends(get_current_user)):
    m = await db.chat_messages.find_one({"id": mid, "conversation_id": cid})
    if not m:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan.")
    if m["sender_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Hanya pengirim yang dapat mengedit pesan.")
    if m.get("deleted"):
        raise HTTPException(status_code=400, detail="Pesan sudah dihapus.")
    if m.get("kind") != "text":
        raise HTTPException(status_code=400, detail="Hanya pesan teks yang dapat diedit.")
    if (time.time() - m["seq"]) > EDIT_WINDOW_SECONDS:
        raise HTTPException(status_code=400, detail="Batas waktu edit (15 menit) telah lewat.")
    if not (req.text or "").strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")
    await db.chat_messages.update_one({"id": mid}, {"$set": {"text": req.text, "edited_at": iso(), "rev": time.time()}})
    return {"ok": True}


@router.delete("/conversations/{cid}/messages/{mid}")
async def unsend_message(cid: str, mid: str, current=Depends(get_current_user)):
    m = await db.chat_messages.find_one({"id": mid, "conversation_id": cid})
    if not m:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan.")
    if m["sender_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Hanya pengirim yang dapat menghapus pesan.")
    await db.chat_messages.update_one({"id": mid}, {"$set": {
        "deleted": True, "text": "", "media_url": None, "duration": None,
        "reply_to_story": None, "rev": time.time()}})
    return {"ok": True}


@router.get("/unread-count")
async def unread_count(current=Depends(get_current_user)):
    total = await db.chat_messages.count_documents(
        {"sender_id": {"$ne": current["id"]}, "read_by": {"$ne": current["id"]},
         "conversation_id": {"$in": [c["id"] for c in await db.conversations.find(
             {"participants": current["id"]}, {"id": 1, "_id": 0}).to_list(500)]}})
    return {"unread": total}


class StoryReplyReq(BaseModel):
    story_id: str
    text: str
    client_message_id: str


@router.post("/reply-story")
async def reply_story(req: StoryReplyReq, current=Depends(get_current_user)):
    if not (req.text or "").strip():
        raise HTTPException(status_code=400, detail="Balasan tidak boleh kosong.")
    story = await db.stories.find_one({"id": req.story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story tidak ditemukan atau sudah kedaluwarsa.")
    author_id = story["author_id"]
    if author_id == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat membalas story Anda sendiri.")
    if await _is_blocked(current["id"], author_id):
        raise HTTPException(status_code=403, detail="Tidak dapat membalas karena pemblokiran.")
    conv = await _get_or_create(current["id"], author_id)
    existing = await db.chat_messages.find_one(
        {"conversation_id": conv["id"], "client_message_id": req.client_message_id}, {"_id": 0})
    if existing:
        return {"conversation_id": conv["id"], "peer": await _peer_info(author_id), "message": existing}
    now = time.time()
    reply_ctx = {
        "story_id": story["id"],
        "preview_text": (story.get("text") or "")[:60],
        "preview_media": story.get("media_url"),
        "background": story.get("background"),
        "author_name": story.get("author_name"),
    }
    msg = {"id": new_id(), "conversation_id": conv["id"], "sender_id": current["id"], "text": req.text,
           "kind": "story_reply", "media_url": None, "duration": None, "reply_to_story": reply_ctx,
           "deleted": False, "edited_at": None,
           "client_message_id": req.client_message_id, "seq": now, "rev": now,
           "read_by": [current["id"]], "created_at": iso()}
    await db.chat_messages.insert_one(msg)
    await db.conversations.update_one({"id": conv["id"]}, {"$set": {"last_message": _preview("story_reply", req.text), "last_at": iso()}})
    msg.pop("_id", None)
    prof = await _profile(current["id"])
    await notify(author_id, "chat", "Balasan Story",
                 f"{(prof or {}).get('display_name') or 'Seseorang'} membalas story Anda: {req.text[:40]}")
    return {"conversation_id": conv["id"], "peer": await _peer_info(author_id), "message": msg}


# ---- Block & Report ----
class UserRef(BaseModel):
    user_id: str


@router.post("/block")
async def block_user(req: UserRef, current=Depends(get_current_user)):
    if req.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat memblokir diri sendiri.")
    await db.chat_blocks.update_one(
        {"blocker": current["id"], "blocked": req.user_id},
        {"$setOnInsert": {"id": new_id(), "blocker": current["id"], "blocked": req.user_id, "created_at": iso()}},
        upsert=True)
    return {"ok": True, "blocked": True}


@router.post("/unblock")
async def unblock_user(req: UserRef, current=Depends(get_current_user)):
    await db.chat_blocks.delete_one({"blocker": current["id"], "blocked": req.user_id})
    return {"ok": True, "blocked": False}


@router.get("/blocks")
async def list_blocks(current=Depends(get_current_user)):
    rows = await db.chat_blocks.find({"blocker": current["id"]}, {"_id": 0}).to_list(200)
    return [r["blocked"] for r in rows]


class ReportReq(BaseModel):
    user_id: str
    reason: str
    message_id: Optional[str] = None


@router.post("/report")
async def report_user(req: ReportReq, current=Depends(get_current_user)):
    if not (req.reason or "").strip():
        raise HTTPException(status_code=400, detail="Alasan laporan wajib diisi.")
    await db.chat_reports.insert_one({
        "id": new_id(), "reporter": current["id"], "reported": req.user_id,
        "reason": req.reason, "message_id": req.message_id, "status": "OPEN", "created_at": iso()})
    return {"ok": True}
