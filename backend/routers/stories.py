from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
from core.db import db
from core.common import new_id
from core.security import get_current_user, iso, now_utc
from core.content import PRIVACY, region_ctx, viewer_ctx, visibility_query, can_view, own_media, validate_music

router = APIRouter(prefix="/api/social/stories", tags=["stories"])


async def _profile(uid):
    return await db.social_profiles.find_one({"user_id": uid}, {"_id": 0})


class StoryReq(BaseModel):
    media_type: str = "text"  # text | photo | video
    text: Optional[str] = ""
    media_url: Optional[str] = None
    background: Optional[str] = "#0369A1"
    music: Optional[dict] = None
    privacy: str = "RT"


@router.post("")
async def create_story(req: StoryReq, current=Depends(get_current_user)):
    if req.media_type not in ("text", "photo", "video"):
        raise HTTPException(status_code=400, detail="Jenis story tidak valid.")
    if req.privacy not in PRIVACY:
        raise HTTPException(status_code=400, detail="Pengaturan privasi tidak valid.")
    if req.media_type == "text" and not (req.text or "").strip():
        raise HTTPException(status_code=400, detail="Isi teks story.")
    if req.media_type == "video":
        await own_media(req.media_url, current["id"], "video/")
    elif req.media_type == "photo" and not (req.media_url or "").startswith(("/api/uploads/", "https://")):
        raise HTTPException(status_code=400, detail="Foto tidak valid.")
    ctx = await region_ctx(current["id"])
    prof = await _profile(current["id"])
    doc = {
        "id": new_id(), "author_id": current["id"],
        "author_name": (prof or {}).get("display_name"), "author_avatar": (prof or {}).get("avatar"),
        "rt_id": ctx["rt_id"], "village_id": ctx["village_id"],
        "media_type": req.media_type, "text": (req.text or "")[:500], "media_url": req.media_url,
        "background": req.background, "music": validate_music(req.music), "privacy": req.privacy,
        "viewers": [], "created_at": iso(), "expires_at": (now_utc() + timedelta(hours=24)).isoformat(),
    }
    await db.stories.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("viewers", None)
    return doc


@router.get("")
async def list_stories(current=Depends(get_current_user)):
    """Active stories visible to the viewer, grouped by author."""
    v = await viewer_ctx(current)
    q = {"expires_at": {"$gt": iso()}, **visibility_query(v)}
    rows = await db.stories.find(q, {"_id": 0}).sort("created_at", 1).to_list(1000)
    groups = {}
    for s in rows:
        s["viewed_by_me"] = current["id"] in s.get("viewers", [])
        s["viewer_count"] = len(s.get("viewers", []))
        s.pop("viewers", None)
        s.setdefault("privacy", "RT")
        groups.setdefault(s["author_id"], {"author_id": s["author_id"], "author_name": s["author_name"],
                                           "author_avatar": s["author_avatar"], "items": []})
        groups[s["author_id"]]["items"].append(s)
    result = list(groups.values())
    for g in result:
        g["all_seen"] = all(i["viewed_by_me"] for i in g["items"])
        g["has_video"] = any(i["media_type"] == "video" for i in g["items"])
    result.sort(key=lambda g: (g["author_id"] != current["id"], g["all_seen"]))
    return result


async def _visible_or_403(story_id, current):
    s = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Story tidak ditemukan.")
    if not can_view(s, await viewer_ctx(current)):
        raise HTTPException(status_code=403, detail="Anda tidak dapat melihat story ini.")
    return s


@router.post("/{story_id}/view")
async def view_story(story_id: str, current=Depends(get_current_user)):
    await _visible_or_403(story_id, current)
    await db.stories.update_one({"id": story_id}, {"$addToSet": {"viewers": current["id"]}})
    return {"ok": True}


@router.get("/{story_id}/viewers")
async def story_viewers(story_id: str, current=Depends(get_current_user)):
    s = await db.stories.find_one({"id": story_id})
    if not s or s["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Hanya pemilik story yang dapat melihat daftar penonton.")
    out = []
    for uid in s.get("viewers", []):
        p = await _profile(uid)
        if p:
            out.append({"display_name": p["display_name"], "username": p["username"]})
    return out


@router.delete("/{story_id}")
async def delete_story(story_id: str, current=Depends(get_current_user)):
    s = await db.stories.find_one({"id": story_id})
    if not s:
        raise HTTPException(status_code=404, detail="Story tidak ditemukan.")
    if s["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Bukan story Anda.")
    await db.stories.delete_one({"id": story_id})
    return {"ok": True}
