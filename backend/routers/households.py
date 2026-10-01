from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from core.db import db
from core.common import new_id, audit
from core.security import get_current_user, iso, nik_hash, encrypt_sensitive
from core.rbac import require_permission, can_access_region

router = APIRouter(prefix="/api/households", tags=["households"])


async def _my_rt(current):
    mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True})
    return mem["rt_id"] if mem else None


class HouseholdReq(BaseModel):
    kk_number: Optional[str] = None
    address: str
    head_name: str


class MemberReq(BaseModel):
    full_name: str
    relation: str  # Kepala Keluarga | Istri | Anak | Lainnya
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    nik: Optional[str] = None


@router.get("/mine")
async def my_household(current=Depends(get_current_user)):
    hh = await db.households.find_one({"owner_id": current["id"]}, {"_id": 0, "kk_encrypted": 0, "kk_hash": 0})
    if not hh:
        return {"household": None, "members": []}
    members = await db.household_members.find({"household_id": hh["id"]}, {"_id": 0, "nik_encrypted": 0, "nik_hash": 0}).to_list(100)
    return {"household": hh, "members": members}


@router.post("")
async def create_household(req: HouseholdReq, current=Depends(get_current_user)):
    rt_id = await _my_rt(current)
    existing = await db.households.find_one({"owner_id": current["id"]})
    doc = {
        "id": existing["id"] if existing else new_id(),
        "owner_id": current["id"], "rt_id": rt_id,
        "address": req.address, "head_name": req.head_name,
        "kk_masked": ("•••• •••• " + req.kk_number[-4:]) if req.kk_number else None,
        "created_at": existing["created_at"] if existing else iso(),
    }
    if req.kk_number:
        doc["kk_hash"] = nik_hash(req.kk_number)
        doc["kk_encrypted"] = encrypt_sensitive(req.kk_number)
    if existing:
        update_op = {"$set": doc}
        if not req.kk_number:
            doc.pop("kk_masked", None)
            update_op["$unset"] = {"kk_hash": "", "kk_encrypted": "", "kk_masked": ""}
        await db.households.update_one({"id": existing["id"]}, update_op)
    else:
        await db.households.insert_one(doc)
        # auto-add head as first member
        await db.household_members.insert_one({
            "id": new_id(), "household_id": doc["id"], "full_name": req.head_name,
            "relation": "Kepala Keluarga", "created_at": iso(),
        })
    await audit(current["id"], "household.save", "household", doc["id"], region_id=rt_id)
    return {"ok": True, "household_id": doc["id"]}


@router.post("/members")
async def add_member(req: MemberReq, current=Depends(get_current_user)):
    hh = await db.households.find_one({"owner_id": current["id"]})
    if not hh:
        raise HTTPException(status_code=400, detail="Buat data Kartu Keluarga terlebih dahulu.")
    m = {"id": new_id(), "household_id": hh["id"], "full_name": req.full_name, "relation": req.relation,
         "gender": req.gender, "birth_date": req.birth_date, "created_at": iso()}
    if req.nik:
        m["nik_hash"] = nik_hash(req.nik)
        m["nik_encrypted"] = encrypt_sensitive(req.nik)
        m["nik_masked"] = "•••• •••• •••• " + req.nik[-4:]
    await db.household_members.insert_one(m)
    return {"ok": True}


@router.delete("/members/{member_id}")
async def remove_member(member_id: str, current=Depends(get_current_user)):
    hh = await db.households.find_one({"owner_id": current["id"]})
    if not hh:
        raise HTTPException(status_code=404, detail="Kartu Keluarga tidak ditemukan.")
    await db.household_members.delete_one({"id": member_id, "household_id": hh["id"]})
    return {"ok": True}


# ---------- RT view ----------
@router.get("")
async def list_households(rt_id: str = Query(...), current=Depends(get_current_user)):
    require_permission(current, "resident.read")
    if not await can_access_region(current, rt_id):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke wilayah ini.")
    rows = await db.households.find({"rt_id": rt_id}, {"_id": 0, "kk_encrypted": 0, "kk_hash": 0}).to_list(2000)
    for r in rows:
        r["member_count"] = await db.household_members.count_documents({"household_id": r["id"]})
    return rows
