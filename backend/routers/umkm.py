"""UMKM Sekitar (resident home) + weekly featured UMKM managed by RT pengurus."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.db import db
from core.common import new_id, audit
from core.security import get_current_user, iso, now_utc
from core.rbac import require_permission, can_access_region, descendant_rt_ids
from core.content import region_ctx

router = APIRouter(prefix="/api/umkm", tags=["umkm"])
WIB = timezone(timedelta(hours=7))


def week_bounds():
    now = datetime.now(WIB)
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return start.date().isoformat(), (start + timedelta(days=7)).astimezone(timezone.utc).isoformat()


async def _card(m, featured=None):
    count = await db.products.count_documents({"merchant_id": m["id"]})
    cover = await db.products.find_one({"merchant_id": m["id"], "image_url": {"$ne": None}}, {"_id": 0, "image_url": 1})
    is_new = m.get("created_at", "") > (now_utc() - timedelta(days=14)).isoformat()
    return {"id": m["id"], "name": m["name"], "category": m.get("category"), "description": m.get("description", ""),
            "logo_url": m.get("logo_url"), "address": m.get("address", ""), "region_id": m.get("region_id"),
            "product_count": count, "cover_url": (cover or {}).get("image_url"), "is_new": is_new,
            "featured": bool(featured), "featured_note": (featured or {}).get("note", "")}


@router.get("/nearby")
async def nearby(current=Depends(get_current_user)):
    ctx = await region_ctx(current["id"])
    if not ctx["rt_id"]:
        return {"has_region": False, "featured": [], "nearby": []}
    week, _ = week_bounds()
    feats = await db.umkm_featured.find({"rt_id": ctx["rt_id"], "week_start": week}, {"_id": 0}).to_list(5)
    featured, seen = [], set()
    for f in feats:
        m = await db.merchants.find_one({"id": f["merchant_id"], "status": "ACTIVE"}, {"_id": 0})
        if m:
            featured.append(await _card(m, f))
            seen.add(m["id"])
    area = ctx["village_id"] or ctx["rt_id"]
    rows = await db.merchants.find({"status": "ACTIVE", "ancestors": area, "id": {"$nin": list(seen)}},
                                   {"_id": 0}).sort("created_at", -1).to_list(12)
    return {"has_region": True, "featured": featured, "nearby": [await _card(m) for m in rows]}


async def _rt_or_403(current, rt_id):
    require_permission(current, "umkm.feature")
    rt = await db.regions.find_one({"id": rt_id, "level": "RT"}, {"_id": 0})
    if not rt or not await can_access_region(current, rt_id):
        raise HTTPException(status_code=403, detail="Wilayah di luar kewenangan Anda.")
    return rt


@router.get("/manage")
async def manage(rt_id: Optional[str] = None, current=Depends(get_current_user)):
    require_permission(current, "umkm.feature")
    ids = await descendant_rt_ids(current)
    if not ids:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki wilayah RT.")
    rt_id = rt_id or ids[0]
    rt = await _rt_or_403(current, rt_id)
    week, expires = week_bounds()
    feat = await db.umkm_featured.find_one({"rt_id": rt_id, "week_start": week}, {"_id": 0})
    merchants = await db.merchants.find({"region_id": rt_id, "status": "ACTIVE"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    rts = await db.regions.find({"id": {"$in": ids[:300]}}, {"_id": 0, "id": 1, "name": 1, "rw_number": 1}).to_list(300)
    return {"rt": {"id": rt["id"], "name": rt["name"], "rw_number": rt.get("rw_number")}, "rts": rts,
            "week_start": week, "expires_at": expires, "featured": feat,
            "merchants": [await _card(m, feat if feat and feat["merchant_id"] == m["id"] else None) for m in merchants]}


class FeatureReq(BaseModel):
    merchant_id: str
    note: str = ""


@router.post("/featured")
async def set_featured(req: FeatureReq, current=Depends(get_current_user)):
    require_permission(current, "umkm.feature")
    m = await db.merchants.find_one({"id": req.merchant_id, "status": "ACTIVE"}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Toko tidak ditemukan.")
    if not m.get("region_id"):
        raise HTTPException(status_code=403, detail="Toko ini belum terhubung ke RT mana pun.")
    await _rt_or_403(current, m["region_id"])
    week, expires = week_bounds()
    doc = {"rt_id": m["region_id"], "week_start": week, "merchant_id": m["id"], "note": req.note.strip()[:140],
           "expires_at": expires, "set_by": current["id"], "updated_at": iso()}
    await db.umkm_featured.update_one({"rt_id": m["region_id"], "week_start": week},
                                      {"$set": doc, "$setOnInsert": {"id": new_id(), "created_at": iso()}}, upsert=True)
    await db.notifications.insert_one({
        "id": new_id(), "user_id": m["owner_user_id"], "type": "UMKM_FEATURED",
        "title": "Toko Anda jadi UMKM Unggulan!", "body": f"{m['name']} ditampilkan sebagai UMKM unggulan RT minggu ini.",
        "entity_id": m["id"], "deep_link": "/app/toko", "read_at": None, "created_at": iso()})
    await audit(current["id"], "umkm.feature", "merchant", m["id"], m["region_id"])
    return await db.umkm_featured.find_one({"rt_id": m["region_id"], "week_start": week}, {"_id": 0})


@router.delete("/featured/{rt_id}")
async def clear_featured(rt_id: str, current=Depends(get_current_user)):
    await _rt_or_403(current, rt_id)
    week, _ = week_bounds()
    await db.umkm_featured.delete_one({"rt_id": rt_id, "week_start": week})
    await audit(current["id"], "umkm.unfeature", "region", rt_id, rt_id)
    return {"ok": True}
