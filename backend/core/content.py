"""Shared visibility rules for Stories and Reels (region-scoped, never platform-wide)."""
import re
from fastapi import HTTPException
from core.db import db

PRIVACY = {"RT", "VILLAGE", "FOLLOWERS"}
MEDIA_RE = re.compile(r"^/api/uploads/([0-9a-f-]{36})$")


async def region_ctx(user_id: str) -> dict:
    mem = await db.memberships.find_one({"user_id": user_id, "is_current": True})
    rt_id = (mem or {}).get("rt_id")
    village_id = None
    if rt_id:
        rt = await db.regions.find_one({"id": rt_id}, {"_id": 0, "ancestors": 1})
        anc = (rt or {}).get("ancestors", [])
        if anc:
            v = await db.regions.find_one({"id": {"$in": anc}, "level": "VILLAGE"}, {"_id": 0, "id": 1})
            village_id = (v or {}).get("id")
    return {"rt_id": rt_id, "village_id": village_id}


async def viewer_ctx(current: dict) -> dict:
    ctx = await region_ctx(current["id"])
    f = await db.follows.find({"follower_id": current["id"]}, {"_id": 0, "following_id": 1}).to_list(5000)
    ctx["me"] = current["id"]
    ctx["following"] = [x["following_id"] for x in f]
    return ctx


def visibility_query(v: dict) -> dict:
    ors = [{"author_id": v["me"]}]
    if v["rt_id"]:
        ors.append({"privacy": "RT", "rt_id": v["rt_id"]})
        ors.append({"privacy": {"$exists": False}, "rt_id": v["rt_id"]})
    if v["village_id"]:
        ors.append({"privacy": "VILLAGE", "village_id": v["village_id"]})
    if v["following"]:
        ors.append({"privacy": "FOLLOWERS", "author_id": {"$in": v["following"]}})
    return {"$or": ors}


def can_view(item: dict, v: dict) -> bool:
    if item["author_id"] == v["me"]:
        return True
    p = item.get("privacy", "RT")
    if p == "RT":
        return bool(v["rt_id"]) and item.get("rt_id") == v["rt_id"]
    if p == "VILLAGE":
        return bool(v["village_id"]) and item.get("village_id") == v["village_id"]
    if p == "FOLLOWERS":
        return item["author_id"] in v["following"]
    return False


async def own_media(url: str, user_id: str, prefix: str) -> dict:
    m = MEDIA_RE.match(url or "")
    doc = await db.media.find_one({"id": m.group(1)}, {"_id": 0}) if m else None
    if not doc or doc["owner_id"] != user_id or not doc["content_type"].startswith(prefix):
        raise HTTPException(status_code=400, detail="Berkas media tidak valid. Unggah ulang berkas Anda.")
    return doc


def validate_music(music):
    if not music:
        return None
    url = (music.get("url") or "").strip()
    title = (music.get("title") or "Musik").strip()[:80]
    if not (re.match(r"^/music/[a-z0-9-]+\.(wav|mp3)$", url) or MEDIA_RE.match(url)):
        raise HTTPException(status_code=400, detail="Musik tidak valid.")
    return {"url": url, "title": title}
