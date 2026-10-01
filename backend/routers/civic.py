from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from core.db import db
from core.common import new_id, audit, notify
from core.security import get_current_user, iso
from core.rbac import require_permission, can_access_region, is_platform_admin

router = APIRouter(prefix="/api/civic", tags=["civic"])


async def _assert(current, rt_id):
    if not await can_access_region(current, rt_id):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke wilayah ini.")


async def _my_rt(current):
    mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True})
    return mem["rt_id"] if mem else None


# ---------------- ANNOUNCEMENTS ----------------
class AnnouncementReq(BaseModel):
    region_id: str
    title: str
    body: str
    target: str = "RT"


@router.post("/announcements")
async def create_announcement(req: AnnouncementReq, current=Depends(get_current_user)):
    require_permission(current, "announcement.manage")
    await _assert(current, req.region_id)
    doc = {"id": new_id(), "region_id": req.region_id, "title": req.title, "body": req.body,
           "target": req.target, "author_id": current["id"], "created_at": iso()}
    await db.announcements.insert_one(doc)
    await audit(current["id"], "announcement.create", "announcement", doc["id"], region_id=req.region_id)
    doc.pop("_id", None)
    return doc


@router.get("/announcements")
async def list_announcements(region_id: Optional[str] = None, current=Depends(get_current_user)):
    rid = region_id or await _my_rt(current)
    if not rid:
        return []
    region = await db.regions.find_one({"id": rid})
    scope_ids = (region.get("ancestors", []) + [rid]) if region else [rid]
    rows = await db.announcements.find({"region_id": {"$in": scope_ids}}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


# ---------------- AGENDA ----------------
class AgendaReq(BaseModel):
    region_id: str
    title: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    start: str
    end: Optional[str] = None


@router.post("/agenda")
async def create_agenda(req: AgendaReq, current=Depends(get_current_user)):
    require_permission(current, "agenda.manage")
    await _assert(current, req.region_id)
    doc = {"id": new_id(), "region_id": req.region_id, "title": req.title, "description": req.description,
           "location": req.location, "start": req.start, "end": req.end,
           "organizer_id": current["id"], "created_at": iso()}
    await db.agendas.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/agenda")
async def list_agenda(region_id: Optional[str] = None, current=Depends(get_current_user)):
    rid = region_id or await _my_rt(current)
    if not rid:
        return []
    region = await db.regions.find_one({"id": rid})
    scope_ids = (region.get("ancestors", []) + [rid]) if region else [rid]
    rows = await db.agendas.find({"region_id": {"$in": scope_ids}}, {"_id": 0}).sort("start", 1).to_list(200)
    return rows


# ---------------- COMPLAINTS ----------------
class ComplaintReq(BaseModel):
    region_id: Optional[str] = None
    category: str
    description: str
    location: Optional[str] = ""
    photo: Optional[str] = None


@router.post("/complaints")
async def create_complaint(req: ComplaintReq, current=Depends(get_current_user)):
    rid = req.region_id or await _my_rt(current)
    if not rid:
        raise HTTPException(status_code=400, detail="Anda belum memilih wilayah RT.")
    doc = {"id": new_id(), "region_id": rid, "category": req.category, "description": req.description,
           "location": req.location, "photo": req.photo, "reporter_id": current["id"],
           "assigned_to": None, "status": "SUBMITTED",
           "timeline": [{"status": "SUBMITTED", "at": iso(), "note": "Pengaduan dibuat"}],
           "resolution": None, "created_at": iso()}
    await db.complaints.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/complaints")
async def list_complaints(region_id: Optional[str] = None, mine: bool = False, current=Depends(get_current_user)):
    if mine:
        rows = await db.complaints.find({"reporter_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
        return rows
    if is_platform_admin(current) and not region_id:
        rows = await db.complaints.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
        for r in rows:
            reporter = await db.persons.find_one({"user_id": r["reporter_id"]}, {"_id": 0})
            r["reporter_name"] = (reporter or {}).get("full_name")
        return rows
    rid = region_id or await _my_rt(current)
    if not rid:
        return []
    await _assert(current, rid)
    region = await db.regions.find_one({"id": rid})
    scope_ids = (region.get("ancestors", []) + [rid]) if region else [rid]
    rows = await db.complaints.find({"region_id": {"$in": scope_ids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        reporter = await db.persons.find_one({"user_id": r["reporter_id"]}, {"_id": 0})
        r["reporter_name"] = (reporter or {}).get("full_name")
    return rows


class ComplaintUpdateReq(BaseModel):
    status: str
    note: Optional[str] = None


@router.post("/complaints/{cid}/update")
async def update_complaint(cid: str, req: ComplaintUpdateReq, current=Depends(get_current_user)):
    require_permission(current, "complaint.manage")
    c = await db.complaints.find_one({"id": cid})
    if not c:
        raise HTTPException(status_code=404, detail="Pengaduan tidak ditemukan.")
    await _assert(current, c["region_id"])
    entry = {"status": req.status, "at": iso(), "note": req.note or ""}
    upd = {"status": req.status}
    if req.status == "RESOLVED":
        upd["resolution"] = req.note
    await db.complaints.update_one({"id": cid}, {"$set": upd, "$push": {"timeline": entry}})
    await notify(c["reporter_id"], "complaint", "Status Pengaduan", f"Pengaduan Anda: {req.status}")
    await audit(current["id"], "complaint.update", "complaint", cid, region_id=c["region_id"], reason=req.status)
    return {"ok": True}


# ---------------- LETTERS ----------------
@router.get("/letter-types")
async def letter_types():
    return await db.letter_types.find({}, {"_id": 0}).to_list(100)


class LetterReq(BaseModel):
    letter_type_id: str
    region_id: Optional[str] = None
    data: dict = {}
    attachments: List[dict] = []


@router.post("/letters")
async def request_letter(req: LetterReq, current=Depends(get_current_user)):
    lt = await db.letter_types.find_one({"id": req.letter_type_id})
    if not lt:
        raise HTTPException(status_code=404, detail="Jenis surat tidak ditemukan.")
    rid = req.region_id or await _my_rt(current)
    if not rid:
        raise HTTPException(status_code=400, detail="Anda belum memilih wilayah RT.")
    person = await db.persons.find_one({"user_id": current["id"]}, {"_id": 0})
    workflow = lt.get("workflow", ["RT"])
    doc = {
        "id": new_id(), "letter_type_id": req.letter_type_id, "letter_type_name": lt["name"],
        "region_id": rid, "requester_id": current["id"], "requester_name": (person or {}).get("full_name"),
        "data": req.data, "workflow": workflow, "current_step": 0, "status": "PENDING_REVIEW",
        "doc_number": None, "attachments": req.attachments or [],
        "steps": [{"role": s, "status": "PENDING", "actor_id": None, "at": None} for s in workflow],
        "created_at": iso(),
    }
    await db.letter_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/letters")
async def list_letters(region_id: Optional[str] = None, mine: bool = False, current=Depends(get_current_user)):
    if mine:
        rows = await db.letter_requests.find({"requester_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
        return rows
    if is_platform_admin(current) and not region_id:
        return await db.letter_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    rid = region_id or await _my_rt(current)
    if not rid:
        return []
    await _assert(current, rid)
    region = await db.regions.find_one({"id": rid})
    scope_ids = (region.get("ancestors", []) + [rid]) if region else [rid]
    rows = await db.letter_requests.find({"region_id": {"$in": scope_ids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


class LetterActionReq(BaseModel):
    action: str  # APPROVE | REJECT
    note: Optional[str] = None


@router.post("/letters/{lid}/action")
async def letter_action(lid: str, req: LetterActionReq, current=Depends(get_current_user)):
    require_permission(current, "letter.approve")
    lr = await db.letter_requests.find_one({"id": lid})
    if not lr:
        raise HTTPException(status_code=404, detail="Surat tidak ditemukan.")
    await _assert(current, lr["region_id"])
    steps = lr["steps"]
    idx = lr["current_step"]
    if req.action == "REJECT":
        steps[idx]["status"] = "REJECTED"
        steps[idx]["actor_id"] = current["id"]
        steps[idx]["at"] = iso()
        await db.letter_requests.update_one({"id": lid}, {"$set": {"status": "REJECTED", "steps": steps}})
        await notify(lr["requester_id"], "letter", "Surat Ditolak", req.note or "Pengajuan surat ditolak.")
        return {"ok": True}
    steps[idx]["status"] = "VERIFIED"
    steps[idx]["actor_id"] = current["id"]
    steps[idx]["at"] = iso()
    if idx + 1 >= len(steps):
        doc_number = f"{lr['letter_type_name'][:3].upper()}/{new_id()[:6].upper()}/{datetime.utcnow().year}"
        await db.letter_requests.update_one({"id": lid}, {"$set": {"status": "VERIFIED", "steps": steps, "doc_number": doc_number, "verified_at": iso()}})
        await notify(lr["requester_id"], "letter", "Surat Selesai", "Surat Anda telah terbit dan dapat diunduh.")
    else:
        await db.letter_requests.update_one({"id": lid}, {"$set": {"current_step": idx + 1, "steps": steps}})
        await notify(lr["requester_id"], "letter", "Surat Diproses", "Surat Anda lanjut ke tahap berikutnya.")
    await audit(current["id"], "letter.approve", "letter", lid, region_id=lr["region_id"])
    return {"ok": True}


# ---------------- DUES / IURAN ----------------
class DuesReq(BaseModel):
    region_id: str
    title: str
    amount: int
    period: str = "monthly"   # monthly | one_time | activity
    due_date: Optional[str] = None


@router.post("/dues")
async def create_dues(req: DuesReq, current=Depends(get_current_user)):
    require_permission(current, "dues.manage")
    await _assert(current, req.region_id)
    doc = {"id": new_id(), "region_id": req.region_id, "title": req.title, "amount": req.amount,
           "period": req.period, "due_date": req.due_date, "created_by": current["id"], "created_at": iso()}
    await db.dues.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/dues")
async def list_dues(region_id: Optional[str] = None, current=Depends(get_current_user)):
    rid = region_id or await _my_rt(current)
    if not rid:
        return []
    rows = await db.dues.find({"region_id": rid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # attach my payment status
    for r in rows:
        pay = await db.dues_payments.find_one({"dues_id": r["id"], "user_id": current["id"]}, {"_id": 0})
        r["my_status"] = pay["status"] if pay else "UNPAID"
    return rows


@router.get("/dues/{dues_id}/payments")
async def dues_payments(dues_id: str, current=Depends(get_current_user)):
    require_permission(current, "dues.manage")
    rows = await db.dues_payments.find({"dues_id": dues_id}, {"_id": 0}).to_list(2000)
    return rows


@router.post("/dues/{dues_id}/pay")
async def pay_dues(dues_id: str, current=Depends(get_current_user)):
    d = await db.dues.find_one({"id": dues_id})
    if not d:
        raise HTTPException(status_code=404, detail="Iuran tidak ditemukan.")
    person = await db.persons.find_one({"user_id": current["id"]}, {"_id": 0})
    existing = await db.dues_payments.find_one({"dues_id": dues_id, "user_id": current["id"]})
    # QRIS/payment is feature-flagged simulation for MVP
    payload = {"status": "PAID", "paid_at": iso(), "method": "QRIS_SIMULATION",
               "payer_name": (person or {}).get("full_name")}
    if existing:
        await db.dues_payments.update_one({"_id": existing["_id"]}, {"$set": payload})
    else:
        await db.dues_payments.insert_one({"id": new_id(), "dues_id": dues_id, "user_id": current["id"],
                                           "amount": d["amount"], "created_at": iso(), **payload})
    return {"ok": True, "status": "PAID", "message": "Pembayaran iuran berhasil (simulasi QRIS)."}
