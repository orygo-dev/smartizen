from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from core.db import db
from core.security import get_current_user
from core.rbac import (
    require_permission, primary_role, scope_ids, is_platform_admin,
    descendant_rt_ids, can_access_region,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(region_id: Optional[str] = None, current=Depends(get_current_user)):
    """Role-aware KPIs computed from real data. No fake numbers."""
    role = primary_role(current)

    # ---- platform admin ----
    if is_platform_admin(current):
        total_users = await db.users.count_documents({})
        verified_residents = await db.memberships.count_documents({"status": "ACTIVE", "is_current": True})
        registered_rt = await db.regions.count_documents({"level": "RT", "status": {"$ne": "UNCLAIMED"}})
        active_rt = await db.regions.count_documents({"level": "RT", "status": "ACTIVE"})
        villages = await db.regions.count_documents({"level": "VILLAGE"})
        pending_apps = await db.rt_applications.count_documents({"status": "PENDING_REVIEW"})
        pending_complaints = await db.complaints.count_documents({"status": {"$in": ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]}})
        claims = await db.rt_claims.count_documents({"status": "CONFLICT"})
        return {"role": role, "scope": "PLATFORM", "kpis": {
            "total_users": total_users, "verified_residents": verified_residents,
            "registered_rt": registered_rt, "active_rt": active_rt, "villages": villages,
            "pending_applications": pending_apps, "pending_complaints": pending_complaints,
            "claim_conflicts": claims,
        }}

    # ---- RT / RW / Village / District / Regency scoped ----
    rt_ids = await descendant_rt_ids(current)
    region_filter = {"$in": rt_ids}
    scoped_region_ids = scope_ids(current)
    all_region_scope = scoped_region_ids + rt_ids

    total_residents = await db.memberships.count_documents({"rt_id": region_filter, "is_current": True})
    verified = await db.memberships.count_documents({"rt_id": region_filter, "status": "ACTIVE", "is_current": True})
    pending = await db.memberships.count_documents({"rt_id": region_filter, "status": "PENDING", "is_current": True})
    letters_pending = await db.letter_requests.count_documents({"region_id": {"$in": all_region_scope}, "status": "PENDING_REVIEW"})
    complaints_active = await db.complaints.count_documents({"region_id": {"$in": all_region_scope}, "status": {"$in": ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]}})
    dues_count = await db.dues.count_documents({"region_id": {"$in": all_region_scope}})
    rt_count = len(rt_ids)
    active_rt_count = await db.regions.count_documents({"id": region_filter, "status": "ACTIVE"})

    kpis = {
        "total_residents": total_residents, "verified_residents": verified,
        "pending_verification": pending, "letters_pending": letters_pending,
        "complaints_active": complaints_active, "dues_total": dues_count,
        "rt_count": rt_count, "active_rt": active_rt_count,
    }
    return {"role": role, "scope": "REGION", "scope_ids": scoped_region_ids, "rt_ids": rt_ids, "kpis": kpis}


@router.get("/recent")
async def recent(region_id: Optional[str] = None, current=Depends(get_current_user)):
    rt_ids = await descendant_rt_ids(current)
    scoped = scope_ids(current) + rt_ids
    new_residents = await db.memberships.find({"rt_id": {"$in": rt_ids}, "is_current": True}, {"_id": 0}).sort("joined_at", -1).to_list(5)
    for m in new_residents:
        p = await db.persons.find_one({"id": m["person_id"]}, {"_id": 0})
        m["name"] = (p or {}).get("full_name")
    letters = await db.letter_requests.find({"region_id": {"$in": scoped}}, {"_id": 0}).sort("created_at", -1).to_list(5)
    complaints = await db.complaints.find({"region_id": {"$in": scoped}}, {"_id": 0}).sort("created_at", -1).to_list(5)
    agenda = await db.agendas.find({"region_id": {"$in": scoped}}, {"_id": 0}).sort("start", 1).to_list(5)
    return {"new_residents": new_residents, "letters": letters, "complaints": complaints, "agenda": agenda}


@router.get("/sub-regions")
async def sub_regions(current=Depends(get_current_user)):
    """List immediate child regions with activity counts (for RW/Village/District dashboards)."""
    scopes = scope_ids(current)
    if is_platform_admin(current):
        children = await db.regions.find({"level": "VILLAGE"}, {"_id": 0}).to_list(500)
    else:
        children = await db.regions.find({"parent_id": {"$in": scopes}}, {"_id": 0}).to_list(500)
    out = []
    for c in children:
        rts = await db.regions.find({"level": "RT", "$or": [{"id": c["id"]}, {"ancestors": c["id"]}]}, {"id": 1}).to_list(10000)
        rt_ids = [r["id"] for r in rts]
        residents = await db.memberships.count_documents({"rt_id": {"$in": rt_ids}, "is_current": True})
        active_rt = await db.regions.count_documents({"id": {"$in": rt_ids}, "status": "ACTIVE"})
        out.append({**c, "rt_total": len(rt_ids), "active_rt": active_rt, "residents": residents})
    return out
