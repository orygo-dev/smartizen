from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
import os
from core.db import db
from core.security import get_current_user
from core.pdf import build_letter_pdf

router = APIRouter(prefix="/api/civic/letters", tags=["letters-pdf"])


async def _region_path(region_id):
    r = await db.regions.find_one({"id": region_id})
    if not r:
        return ""
    ids = r.get("ancestors", []) + [region_id]
    rows = await db.regions.find({"id": {"$in": ids}}, {"_id": 0}).to_list(50)
    rows.sort(key=lambda x: len(x.get("ancestors", [])))
    return ", ".join(x["name"] for x in rows[-3:])


@router.get("/{lid}/pdf")
async def letter_pdf(lid: str, current=Depends(get_current_user)):
    lr = await db.letter_requests.find_one({"id": lid}, {"_id": 0})
    if not lr:
        raise HTTPException(status_code=404, detail="Surat tidak ditemukan.")
    if lr["status"] != "VERIFIED":
        raise HTTPException(status_code=400, detail="Surat belum terbit. Hanya surat terverifikasi yang dapat diunduh.")
    app_url = os.environ.get("APP_URL", "")
    verify_url = f"{app_url}/verifikasi/surat/{lid}"
    region_path = await _region_path(lr["region_id"])
    pdf = build_letter_pdf(lr, verify_url, region_path)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{lr.get("doc_number","surat")}.pdf"'})


@router.get("/verify/{lid}")
async def verify_letter(lid: str):
    """Public QR verification — returns minimal non-PII info."""
    lr = await db.letter_requests.find_one({"id": lid}, {"_id": 0})
    if not lr:
        return {"valid": False}
    return {
        "valid": lr["status"] == "VERIFIED",
        "doc_number": lr.get("doc_number"),
        "letter_type_name": lr.get("letter_type_name"),
        "requester_name": lr.get("requester_name"),
        "status": lr.get("status"),
        "verified_at": lr.get("verified_at"),
    }
