from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId

from core.db import db
from core.common import new_id, audit, notify
from core.security import get_current_user, iso
from core.rbac import require_permission, is_platform_admin

router = APIRouter(prefix="/api/rt", tags=["rt"])


class OfficialData(BaseModel):
    name: str
    position: str = "Ketua RT"
    phone: Optional[str] = None


class RtApplicationReq(BaseModel):
    rw_id: str                 # chosen RW region
    rt_number: str             # e.g. "005"
    rt_name: Optional[str] = None
    profile: dict = {}         # address, household count, etc.
    official: OfficialData
    documents: List[dict] = [] # [{type, name, file_key}]


async def _ensure_rt_region(rw_id: str, rt_number: str):
    rw = await db.regions.find_one({"id": rw_id, "level": "RW"})
    if not rw:
        raise HTTPException(status_code=404, detail="RW tidak ditemukan.")
    name = f"RT {rt_number}"
    rt = await db.regions.find_one({"level": "RT", "parent_id": rw_id, "rt_number": rt_number})
    if not rt:
        rt = {
            "id": new_id(), "level": "RT", "name": name,
            "code": f"{rw.get('code','')}-{rt_number}", "parent_id": rw_id,
            "ancestors": rw.get("ancestors", []) + [rw_id],
            "rt_number": rt_number, "rw_number": rw.get("rw_number"),
            "status": "UNCLAIMED", "created_at": iso(),
        }
        await db.regions.insert_one(rt)
    return rt


@router.post("/applications")
async def create_application(req: RtApplicationReq, current=Depends(get_current_user)):
    rt = await _ensure_rt_region(req.rw_id, req.rt_number)
    # Duplicate detection: if RT already ACTIVE, open a claim conflict instead of a new application
    if rt.get("status") == "ACTIVE":
        existing_head = await db.role_assignments.find_one({"role": "RT_HEAD", "scope_id": rt["id"], "status": "ACTIVE"})
        claim = {
            "id": new_id(), "rt_id": rt["id"], "claimant_user_id": current["id"],
            "official": req.official.model_dump(), "documents": req.documents,
            "status": "CONFLICT", "existing_head_user_id": (existing_head or {}).get("user_id"),
            "created_at": iso(),
        }
        await db.rt_claims.insert_one(claim)
        await audit(current["id"], "rt_claim.create", "rt", rt["id"])
        return {"conflict": True, "message": "RT ini sudah terdaftar. Klaim Anda dikirim untuk ditinjau Admin Rakatin.",
                "rt_id": rt["id"]}
    app = {
        "id": new_id(), "rt_id": rt["id"], "rw_id": req.rw_id, "rt_number": req.rt_number,
        "rt_name": req.rt_name or rt["name"], "applicant_user_id": current["id"],
        "profile": req.profile, "official": req.official.model_dump(),
        "documents": req.documents, "status": "PENDING_REVIEW",
        "review_note": None, "created_at": iso(), "updated_at": iso(),
    }
    await db.rt_applications.insert_one(app)
    await db.regions.update_one({"id": rt["id"]}, {"$set": {"status": "PENDING_REVIEW"}})
    await audit(current["id"], "rt_application.submit", "rt_application", app["id"], region_id=rt["id"])
    app.pop("_id", None)
    return {"conflict": False, "application": app}


@router.get("/applications/mine")
async def my_applications(current=Depends(get_current_user)):
    rows = await db.rt_applications.find({"applicant_user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return rows


@router.get("/applications")
async def list_applications(status: Optional[str] = None, current=Depends(get_current_user)):
    require_permission(current, "rt_application.review")
    q = {}
    if status:
        q["status"] = status
    rows = await db.rt_applications.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        applicant = await db.persons.find_one({"user_id": r["applicant_user_id"]}, {"_id": 0})
        r["applicant_name"] = (applicant or {}).get("full_name")
        region = await db.regions.find_one({"id": r["rt_id"]}, {"_id": 0})
        r["region_path"] = [a for a in (region or {}).get("ancestors", [])]
    return rows


@router.post("/applications/{app_id}/verify")
async def verify_application(app_id: str, current=Depends(get_current_user)):
    require_permission(current, "rt_application.review")
    app = await db.rt_applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan.")
    if app["status"] not in ("PENDING_REVIEW", "NEED_REVISION"):
        raise HTTPException(status_code=400, detail="Status pengajuan tidak dapat diverifikasi.")
    rt_id = app["rt_id"]
    # transaction-like sequence
    await db.rt_applications.update_one({"id": app_id}, {"$set": {"status": "VERIFIED", "updated_at": iso()}})
    await db.regions.update_one({"id": rt_id}, {"$set": {"status": "ACTIVE"}})
    await db.role_assignments.insert_one({
        "id": new_id(), "user_id": app["applicant_user_id"], "role": "RT_HEAD",
        "scope_type": "RT", "scope_id": rt_id, "status": "ACTIVE",
        "start_date": iso(), "end_date": None, "assigned_by": current["id"], "created_at": iso(),
    })
    # pending residents who registered before RT joined are now visible; flip their membership label
    await db.memberships.update_many(
        {"rt_id": rt_id, "status": "PENDING_RT_VERIFICATION"}, {"$set": {"status": "PENDING"}}
    )
    await audit(current["id"], "rt_application.verify", "rt_application", app_id, region_id=rt_id)
    await notify(app["applicant_user_id"], "activation", "RT Terverifikasi",
                 "Selamat! RT Anda telah terverifikasi. Dashboard RT kini aktif.", entity_id=rt_id)
    return {"ok": True, "message": "RT berhasil diverifikasi dan diaktifkan."}


class ReviewReq(BaseModel):
    note: Optional[str] = None


@router.post("/applications/{app_id}/reject")
async def reject_application(app_id: str, req: ReviewReq, current=Depends(get_current_user)):
    require_permission(current, "rt_application.review")
    app = await db.rt_applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan.")
    await db.rt_applications.update_one({"id": app_id}, {"$set": {"status": "REJECTED", "review_note": req.note, "updated_at": iso()}})
    await db.regions.update_one({"id": app["rt_id"]}, {"$set": {"status": "UNCLAIMED"}})
    await audit(current["id"], "rt_application.reject", "rt_application", app_id, reason=req.note)
    await notify(app["applicant_user_id"], "activation", "Pengajuan RT Ditolak", req.note or "Pengajuan Anda ditolak.")
    return {"ok": True}


@router.post("/applications/{app_id}/request-revision")
async def request_revision(app_id: str, req: ReviewReq, current=Depends(get_current_user)):
    require_permission(current, "rt_application.review")
    app = await db.rt_applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan.")
    await db.rt_applications.update_one({"id": app_id}, {"$set": {"status": "NEED_REVISION", "review_note": req.note, "updated_at": iso()}})
    await notify(app["applicant_user_id"], "activation", "Perlu Revisi", req.note or "Mohon lengkapi data pengajuan RT Anda.")
    return {"ok": True}


# ---------- claims ----------
@router.get("/claims")
async def list_claims(current=Depends(get_current_user)):
    require_permission(current, "rt_application.review")
    rows = await db.rt_claims.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


class ClaimResolveReq(BaseModel):
    action: str  # KEEP_EXISTING | REPLACE_OFFICIAL | REQUEST_MORE_EVIDENCE | REJECT_CLAIM
    note: Optional[str] = None


@router.post("/claims/{claim_id}/resolve")
async def resolve_claim(claim_id: str, req: ClaimResolveReq, current=Depends(get_current_user)):
    require_permission(current, "rt_application.review")
    claim = await db.rt_claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Klaim tidak ditemukan.")
    rt_id = claim["rt_id"]
    if req.action == "REPLACE_OFFICIAL":
        # end old RT_HEAD, assign new — RT entity & data unchanged
        await db.role_assignments.update_many(
            {"role": "RT_HEAD", "scope_id": rt_id, "status": "ACTIVE"},
            {"$set": {"status": "EXPIRED", "end_date": iso()}},
        )
        await db.role_assignments.insert_one({
            "id": new_id(), "user_id": claim["claimant_user_id"], "role": "RT_HEAD",
            "scope_type": "RT", "scope_id": rt_id, "status": "ACTIVE",
            "start_date": iso(), "end_date": None, "assigned_by": current["id"], "created_at": iso(),
        })
        status = "RESOLVED_REPLACED"
    elif req.action == "KEEP_EXISTING" or req.action == "REJECT_CLAIM":
        status = "RESOLVED_KEPT"
    else:
        status = "NEED_EVIDENCE"
    await db.rt_claims.update_one({"id": claim_id}, {"$set": {"status": status, "note": req.note, "resolved_at": iso()}})
    await audit(current["id"], f"rt_claim.{req.action.lower()}", "rt", rt_id, reason=req.note)
    return {"ok": True, "status": status}


class InviteReq(BaseModel):
    rt_id: str
    phone: Optional[str] = None
    message: Optional[str] = None


@router.post("/invite")
async def invite_rt(req: InviteReq, current=Depends(get_current_user)):
    inv = {"id": new_id(), "rt_id": req.rt_id, "invited_by": current["id"],
           "phone": req.phone, "message": req.message, "status": "SENT", "created_at": iso()}
    await db.rt_invitations.insert_one(inv)
    inv.pop("_id", None)
    return {"ok": True, "invitation": inv, "message": "Undangan untuk Ketua RT telah dibuat."}
