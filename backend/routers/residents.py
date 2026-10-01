from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from core.db import db
from core.common import new_id, audit, notify
from core.security import get_current_user, iso, nik_hash, encrypt_sensitive
from core.rbac import require_permission, can_access_region, descendant_rt_ids

router = APIRouter(prefix="/api/residents", tags=["residents"])


class ChooseRegionReq(BaseModel):
    rt_id: str
    nik: Optional[str] = None
    address: Optional[str] = None


@router.post("/membership")
async def create_membership(req: ChooseRegionReq, current=Depends(get_current_user)):
    """Resident chooses a region (RT). Works even if RT hasn't joined Rakatin yet."""
    rt = await db.regions.find_one({"id": req.rt_id, "level": "RT"})
    if not rt:
        raise HTTPException(status_code=404, detail="RT tidak ditemukan.")
    person = await db.persons.find_one({"user_id": current["id"]})
    if not person:
        raise HTTPException(status_code=400, detail="Profil belum lengkap.")
    pid = person["id"]
    update = {}
    if req.nik:
        update["nik_hash"] = nik_hash(req.nik)
        update["nik_encrypted"] = encrypt_sensitive(req.nik)
    if req.address:
        update["address"] = req.address
    if update:
        await db.persons.update_one({"id": pid}, {"$set": update})
    # end previous current membership (move RT) — never overwrite history
    await db.memberships.update_many(
        {"person_id": pid, "is_current": True},
        {"$set": {"is_current": False, "status": "ENDED", "ended_at": iso()}},
    )
    status = "PENDING" if rt.get("status") == "ACTIVE" else "PENDING_RT_VERIFICATION"
    mem = {
        "id": new_id(), "person_id": pid, "user_id": current["id"], "rt_id": req.rt_id,
        "status": status, "joined_at": iso(), "verified_at": None, "verified_by": None,
        "ended_at": None, "is_current": True, "created_at": iso(),
    }
    await db.memberships.insert_one(mem)
    # grant RESIDENT role scoped to RT
    exists = await db.role_assignments.find_one({"user_id": current["id"], "role": "RESIDENT", "scope_id": req.rt_id})
    if not exists:
        await db.role_assignments.insert_one({
            "id": new_id(), "user_id": current["id"], "role": "RESIDENT",
            "scope_type": "RT", "scope_id": req.rt_id, "status": "ACTIVE",
            "start_date": iso(), "end_date": None, "assigned_by": "self", "created_at": iso(),
        })
    await audit(current["id"], "membership.create", "membership", mem["id"], region_id=req.rt_id)
    mem.pop("_id", None)
    return {"membership": mem, "rt_status": rt.get("status"),
            "rt_joined": rt.get("status") == "ACTIVE",
            "message": "RT Anda belum bergabung di Rakatin." if rt.get("status") != "ACTIVE" else "Keanggotaan dikirim untuk verifikasi RT."}


@router.get("/my-membership")
async def my_membership(current=Depends(get_current_user)):
    mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True}, {"_id": 0})
    if not mem:
        return {"membership": None}
    rt = await db.regions.find_one({"id": mem["rt_id"]}, {"_id": 0})
    path = await db.regions.find({"id": {"$in": rt.get("ancestors", []) + [rt["id"]]}}, {"_id": 0}).to_list(50) if rt else []
    path.sort(key=lambda x: len(x.get("ancestors", [])))
    return {"membership": mem, "rt": rt, "region_path": path}


# ---------- RT side: resident management ----------
async def _assert_rt_access(current, rt_id):
    if not await can_access_region(current, rt_id):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke wilayah ini.")


@router.get("")
async def list_residents(rt_id: str = Query(...), status: Optional[str] = None, current=Depends(get_current_user)):
    require_permission(current, "resident.read")
    await _assert_rt_access(current, rt_id)
    q = {"rt_id": rt_id, "is_current": True}
    if status:
        q["status"] = status
    mems = await db.memberships.find(q, {"_id": 0}).sort("joined_at", -1).to_list(2000)
    out = []
    for m in mems:
        person = await db.persons.find_one({"id": m["person_id"]}, {"_id": 0, "nik_encrypted": 0, "nik_hash": 0})
        user = await db.users.find_one({"_id": __import__("bson").ObjectId(m["user_id"])})
        out.append({**m, "person": person, "phone": (user or {}).get("phone"),
                    "verified_rakatin": bool((user or {}).get("phone_verified_at"))})
    return out


@router.get("/pending-count")
async def pending_count(rt_id: str = Query(...), current=Depends(get_current_user)):
    await _assert_rt_access(current, rt_id)
    c = await db.memberships.count_documents({"rt_id": rt_id, "status": "PENDING", "is_current": True})
    return {"count": c}


class VerifyReq(BaseModel):
    action: str  # APPROVE | REJECT | REQUEST_INFO
    note: Optional[str] = None


@router.post("/membership/{membership_id}/verify")
async def verify_membership(membership_id: str, req: VerifyReq, current=Depends(get_current_user)):
    require_permission(current, "resident.verify")
    mem = await db.memberships.find_one({"id": membership_id})
    if not mem:
        raise HTTPException(status_code=404, detail="Keanggotaan tidak ditemukan.")
    await _assert_rt_access(current, mem["rt_id"])
    if req.action == "APPROVE":
        await db.memberships.update_one({"id": membership_id}, {"$set": {"status": "ACTIVE", "verified_at": iso(), "verified_by": current["id"]}})
        await notify(mem["user_id"], "activation", "Verifikasi Warga", "Keanggotaan warga Anda telah disetujui RT.")
        msg = "Warga diverifikasi."
    elif req.action == "REJECT":
        await db.memberships.update_one({"id": membership_id}, {"$set": {"status": "REJECTED"}})
        msg = "Keanggotaan ditolak."
    else:
        msg = "Permintaan informasi dikirim."
    await audit(current["id"], f"resident.{req.action.lower()}", "membership", membership_id, region_id=mem["rt_id"])
    return {"ok": True, "message": msg}
