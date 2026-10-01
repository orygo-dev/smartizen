from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.db import db
from core.common import new_id
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


@router.delete("/{reel_id}")
async def delete_reel(reel_id: str, current=Depends(get_current_user)):
    r = await db.reels.find_one({"id": reel_id})
    if not r:
        raise HTTPException(status_code=404, detail="Reel tidak ditemukan.")
    if r["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Bukan reel Anda.")
    await db.reels.delete_one({"id": reel_id})
    return {"ok": True}
