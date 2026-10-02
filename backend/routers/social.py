from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from core.db import db
from core.common import new_id, audit
from core.security import get_current_user, iso
from core.content import viewer_ctx, can_view, region_ctx
from core.rbac import is_platform_admin, descendant_rt_ids

router = APIRouter(prefix="/api/social", tags=["social"])

FEED_CATEGORIES = ["Umum", "Kegiatan", "Info Warga", "UMKM", "Lingkungan", "Kehilangan", "Acara", "Jual/Beli"]


async def _profile(user_id):
    return await db.social_profiles.find_one({"user_id": user_id}, {"_id": 0})


class PostReq(BaseModel):
    text: str
    category: str = "Umum"
    photos: list = []
    location: Optional[str] = None


@router.get("/feed/categories")
async def categories():
    return FEED_CATEGORIES


@router.post("/feed")
async def create_post(req: PostReq, current=Depends(get_current_user)):
    mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True})
    prof = await _profile(current["id"])
    doc = {
        "id": new_id(), "author_id": current["id"],
        "author_name": (prof or {}).get("display_name"), "author_avatar": (prof or {}).get("avatar"),
        "rt_id": (mem or {}).get("rt_id"), "text": req.text, "category": req.category,
        "photos": req.photos, "location": req.location,
        "like_count": 0, "comment_count": 0, "likes": [], "created_at": iso(),
    }
    await db.feed_posts.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def _feed_rt_ids(current, scope="village"):
    """RT ids whose posts the viewer may see; None = platform-wide (platform admins only)."""
    if is_platform_admin(current):
        return None
    ids = set(await descendant_rt_ids(current))
    ctx = await region_ctx(current["id"])
    if ctx["rt_id"]:
        ids.add(ctx["rt_id"])
        if scope != "rt" and ctx["village_id"]:
            rts = await db.regions.find({"level": "RT", "ancestors": ctx["village_id"]}, {"_id": 0, "id": 1}).to_list(2000)
            ids |= {r["id"] for r in rts}
    return ids


async def _post_or_403(post_id, current):
    post = await db.feed_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Postingan tidak ditemukan.")
    allowed = await _feed_rt_ids(current)
    if allowed is not None and post.get("rt_id") not in allowed and post["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Postingan ini di luar wilayah Anda.")
    return post


@router.get("/feed")
async def list_feed(category: Optional[str] = None, rt_id: Optional[str] = None, scope: str = "village",
                    current=Depends(get_current_user)):
    q = {}
    if category and category != "Semua":
        q["category"] = category
    allowed = await _feed_rt_ids(current, "village" if rt_id else scope)
    if rt_id:
        if allowed is not None and rt_id not in allowed:
            raise HTTPException(status_code=403, detail="Wilayah di luar kewenangan Anda.")
        q["rt_id"] = rt_id
    elif allowed is not None:
        q["$or"] = [{"rt_id": {"$in": list(allowed)}}, {"author_id": current["id"]}]
    rows = await db.feed_posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    rt_names = {r["id"]: r for r in await db.regions.find(
        {"id": {"$in": list({p.get("rt_id") for p in rows if p.get("rt_id")})}},
        {"_id": 0, "id": 1, "name": 1, "rw_number": 1}).to_list(500)}
    v = await viewer_ctx(current) if any(r.get("reel_id") for r in rows) else None
    for r in rows:
        rt = rt_names.get(r.get("rt_id"))
        r["rt_name"] = f"{rt['name']} / RW {rt.get('rw_number')}" if rt else None
        r["liked_by_me"] = current["id"] in r.get("likes", [])
        r.pop("likes", None)
        if r.get("reel_id"):
            reel = await db.reels.find_one({"id": r["reel_id"]}, {"_id": 0, "likes": 0})
            r["reel"] = ({k: reel.get(k) for k in ("id", "media_url", "caption", "author_name", "music", "privacy")}
                         if reel and can_view(reel, v) else {"unavailable": True})
    return rows


@router.post("/feed/{post_id}/like")
async def toggle_like(post_id: str, current=Depends(get_current_user)):
    post = await _post_or_403(post_id, current)
    likes = post.get("likes", [])
    if current["id"] in likes:
        likes.remove(current["id"])
        liked = False
    else:
        likes.append(current["id"])
        liked = True
    await db.feed_posts.update_one({"id": post_id}, {"$set": {"likes": likes, "like_count": len(likes)}})
    return {"liked": liked, "like_count": len(likes)}


class CommentReq(BaseModel):
    text: str


@router.get("/feed/{post_id}/comments")
async def list_comments(post_id: str, current=Depends(get_current_user)):
    await _post_or_403(post_id, current)
    return await db.feed_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@router.post("/feed/{post_id}/comments")
async def add_comment(post_id: str, req: CommentReq, current=Depends(get_current_user)):
    await _post_or_403(post_id, current)
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Komentar tidak boleh kosong.")
    prof = await _profile(current["id"])
    doc = {"id": new_id(), "post_id": post_id, "author_id": current["id"],
           "author_name": (prof or {}).get("display_name"), "text": req.text, "created_at": iso()}
    await db.feed_comments.insert_one(doc)
    await db.feed_posts.update_one({"id": post_id}, {"$inc": {"comment_count": 1}})
    doc.pop("_id", None)
    return doc


# ---------------- FOLLOW ----------------
@router.post("/follow/{user_id}")
async def follow(user_id: str, current=Depends(get_current_user)):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat mengikuti diri sendiri.")
    existing = await db.follows.find_one({"follower_id": current["id"], "following_id": user_id})
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        await db.social_profiles.update_one({"user_id": user_id}, {"$inc": {"followers": -1}})
        await db.social_profiles.update_one({"user_id": current["id"]}, {"$inc": {"following": -1}})
        return {"following": False}
    await db.follows.insert_one({"id": new_id(), "follower_id": current["id"], "following_id": user_id, "created_at": iso()})
    await db.social_profiles.update_one({"user_id": user_id}, {"$inc": {"followers": 1}})
    await db.social_profiles.update_one({"user_id": current["id"]}, {"$inc": {"following": 1}})
    return {"following": True}


@router.get("/warga")
async def warga_discovery(tab: str = "rt", current=Depends(get_current_user)):
    """Warga RT Saya only for verified residents; never a national directory."""
    if tab == "rt":
        mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True, "status": "ACTIVE"})
        if not mem:
            return {"locked": True, "message": "Fitur ini tersedia setelah keanggotaan RT Anda terverifikasi.", "items": []}
        mems = await db.memberships.find({"rt_id": mem["rt_id"], "status": "ACTIVE", "is_current": True}, {"_id": 0}).to_list(500)
        items = []
        for m in mems:
            prof = await _profile(m["user_id"])
            if prof:
                items.append(prof)
        return {"locked": False, "items": items}
    if tab == "following":
        f = await db.follows.find({"follower_id": current["id"]}).to_list(1000)
        ids = [x["following_id"] for x in f]
        items = await db.social_profiles.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(1000)
        return {"locked": False, "items": items}
    return {"locked": False, "items": []}


@router.get("/notifications")
async def notifications(current=Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    unread = sum(1 for r in rows if not r.get("read_at"))
    return {"items": rows, "unread": unread}


@router.get("/notifications/unread-count")
async def notifications_unread_count(current=Depends(get_current_user)):
    unread = await db.notifications.count_documents({"user_id": current["id"], "read_at": None})
    return {"unread": unread}


@router.post("/notifications/read-all")
async def read_all(current=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current["id"], "read_at": None}, {"$set": {"read_at": iso()}})
    return {"ok": True}
