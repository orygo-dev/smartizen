from fastapi import APIRouter, Depends, Query
from typing import Optional
from core.db import db
from core.common import cleans, clean
from core.security import get_current_user

router = APIRouter(prefix="/api/regions", tags=["regions"])


@router.get("")
async def list_regions(level: Optional[str] = None, parent_id: Optional[str] = Query(None)):
    q = {}
    if level:
        q["level"] = level
    if parent_id is not None:
        q["parent_id"] = parent_id
    rows = await db.regions.find(q, {"_id": 0}).sort("name", 1).to_list(5000)
    return rows


@router.get("/tree-root")
async def root_regions():
    rows = await db.regions.find({"level": "PROVINCE"}, {"_id": 0}).sort("name", 1).to_list(100)
    return rows


@router.get("/{region_id}")
async def get_region(region_id: str):
    r = await db.regions.find_one({"id": region_id}, {"_id": 0})
    if not r:
        return {}
    # attach breadcrumb names
    anc = await db.regions.find({"id": {"$in": r.get("ancestors", [])}}, {"_id": 0}).to_list(100)
    r["ancestor_names"] = [a["name"] for a in sorted(anc, key=lambda x: len(x.get("ancestors", [])))]
    return r


@router.get("/{region_id}/path")
async def region_path(region_id: str):
    r = await db.regions.find_one({"id": region_id}, {"_id": 0})
    if not r:
        return []
    ids = r.get("ancestors", []) + [region_id]
    rows = await db.regions.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)
    rows.sort(key=lambda x: len(x.get("ancestors", [])))
    return rows
