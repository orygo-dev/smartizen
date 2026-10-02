from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.db import db
from core.common import new_id, notify
from core.security import get_current_user, iso
from core.content import PRIVACY, region_ctx, viewer_ctx, visibility_query, can_view, own_media, validate_music

router = APIRouter(prefix="/api/reels", tags=["reels"])


class ReelReq(BaseModel):
    media_url: str
    caption: str = ""
    music: Optional[dict] = None
    privacy: str = "RT"


def _out(r, me):
    likes = r.pop("likes", [])
    r["liked_by_me"] = me in likes
    r["like_count"] = len(likes)
    r["is_mine"] = r["author_id"] == me
    return r


@router.post("")
async def create_reel(req: ReelReq, current=Depends(get_current_user)):
    if req.privacy not in PRIVACY:
        raise HTTPException(status_code=400, detail="Pengaturan privasi tidak valid.")
    media = await own_media(req.media_url, current["id"], "video/")
    ctx = await region_ctx(current["id"])
    prof = await db.social_profiles.find_one({"user_id": current["id"]}, {"_id": 0})
    doc = {
        "id": new_id(), "author_id": current["id"],
        "author_name": (prof or {}).get("display_name"), "author_avatar": (prof or {}).get("avatar"),
        "rt_id": ctx["rt_id"], "village_id": ctx["village_id"],
        "media_url": req.media_url, "media_size": media["size"], "caption": req.caption.strip()[:300],
        "music": validate_music(req.music), "privacy": req.privacy,
        "likes": [], "view_count": 0, "created_at": iso(),
    }
    await db.reels.insert_one(doc)
    doc.pop("_id", None)
    return _out(doc, current["id"])


@router.get("")
async def reel_feed(current=Depends(get_current_user)):
    v = await viewer_ctx(current)
    rows = await db.reels.find(visibility_query(v), {"_id": 0}).sort("created_at", -1).to_list(50)
    return [_out(r, current["id"]) for r in rows]


async def _visible(reel_id, current):
    r = await db.reels.find_one({"id": reel_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Reel tidak ditemukan.")
    if not can_view(r, await viewer_ctx(current)):
        raise HTTPException(status_code=403, detail="Anda tidak dapat melihat reel ini.")
    return r


@router.post("/{reel_id}/like")
async def toggle_like(reel_id: str, current=Depends(get_current_user)):
    r = await _visible(reel_id, current)
    liked = current["id"] in r.get("likes", [])
    op = "$pull" if liked else "$addToSet"
    await db.reels.update_one({"id": reel_id}, {op: {"likes": current["id"]}})
    return {"liked": not liked, "like_count": len(r.get("likes", [])) + (-1 if liked else 1)}


@router.post("/{reel_id}/view")
async def view_reel(reel_id: str, current=Depends(get_current_user)):
    await _visible(reel_id, current)
    await db.reels.update_one({"id": reel_id}, {"$inc": {"view_count": 1}})
    return {"ok": True}


class CommentReq(BaseModel):
    text: str


@router.get("/{reel_id}/comments")
async def list_comments(reel_id: str, current=Depends(get_current_user)):
    r = await _visible(reel_id, current)
    rows = await db.reel_comments.find({"reel_id": reel_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for c in rows:
        c["can_delete"] = current["id"] in (c["author_id"], r["author_id"])
    return rows


@router.post("/{reel_id}/comments")
async def add_comment(reel_id: str, req: CommentReq, current=Depends(get_current_user)):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Komentar tidak boleh kosong.")
    r = await _visible(reel_id, current)
    prof = await db.social_profiles.find_one({"user_id": current["id"]}, {"_id": 0})
    doc = {"id": new_id(), "reel_id": reel_id, "author_id": current["id"],
           "author_name": (prof or {}).get("display_name"), "text": text[:500], "created_at": iso()}
    await db.reel_comments.insert_one(doc)
    await db.reels.update_one({"id": reel_id}, {"$inc": {"comment_count": 1}})
    if r["author_id"] != current["id"]:
        await notify(r["author_id"], "REEL_COMMENT", "Komentar baru di reel Anda",
                     f"{doc['author_name'] or 'Warga'}: {text[:80]}", "/app/reels", reel_id)
    doc.pop("_id", None)
    doc["can_delete"] = True
    return doc


@router.delete("/{reel_id}/comments/{comment_id}")
async def delete_comment(reel_id: str, comment_id: str, current=Depends(get_current_user)):
    c = await db.reel_comments.find_one({"id": comment_id, "reel_id": reel_id})
    r = await db.reels.find_one({"id": reel_id})
    if not c or not r:
        raise HTTPException(status_code=404, detail="Komentar tidak ditemukan.")
    if current["id"] not in (c["author_id"], r["author_id"]):
        raise HTTPException(status_code=403, detail="Anda tidak dapat menghapus komentar ini.")
    await db.reel_comments.delete_one({"id": comment_id})
    await db.reels.update_one({"id": reel_id}, {"$inc": {"comment_count": -1}})
    return {"ok": True}


class ShareReq(BaseModel):
    text: str = ""


@router.post("/{reel_id}/share")
async def share_to_feed(reel_id: str, req: ShareReq, current=Depends(get_current_user)):
    r = await _visible(reel_id, current)
    ctx = await region_ctx(current["id"])
    if not ctx["rt_id"]:
        raise HTTPException(status_code=400, detail="Bergabung dengan RT terlebih dahulu untuk berbagi ke Feed RT.")
    prof = await db.social_profiles.find_one({"user_id": current["id"]}, {"_id": 0})
    doc = {"id": new_id(), "author_id": current["id"],
           "author_name": (prof or {}).get("display_name"), "author_avatar": (prof or {}).get("avatar"),
           "rt_id": ctx["rt_id"], "text": req.text.strip()[:1000], "category": "Umum", "photos": [],
           "location": None, "reel_id": reel_id, "like_count": 0, "comment_count": 0, "likes": [], "created_at": iso()}
    await db.feed_posts.insert_one(doc)
    await db.reels.update_one({"id": reel_id}, {"$inc": {"share_count": 1}})
    if r["author_id"] != current["id"]:
        await notify(r["author_id"], "REEL_SHARE", "Reel Anda dibagikan",
                     f"{doc['author_name'] or 'Warga'} membagikan reel Anda ke Feed RT.", "/app/feed", reel_id)
    doc.pop("_id", None)
    doc.pop("likes", None)
    return doc


@router.delete("/{reel_id}")
async def delete_reel(reel_id: str, current=Depends(get_current_user)):
    r = await db.reels.find_one({"id": reel_id})
    if not r:
        raise HTTPException(status_code=404, detail="Reel tidak ditemukan.")
    if r["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Bukan reel Anda.")
    await db.reels.delete_one({"id": reel_id})
    await db.reel_comments.delete_many({"reel_id": reel_id})
    return {"ok": True}
