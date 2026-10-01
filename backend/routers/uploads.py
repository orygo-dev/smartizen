from collections import OrderedDict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from core.db import db
from core.common import new_id
from core.security import get_current_user, iso
from core.storage import storage, read_media, APP_NAME

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

LIMITS = {"image/": 10, "audio/": 10, "video/": 50, "application/pdf": 10}  # MB
_cache: "OrderedDict[str, bytes]" = OrderedDict()
CACHE_ITEMS = 6


def _limit_mb(ctype: str):
    for prefix, mb in LIMITS.items():
        if ctype.startswith(prefix):
            return mb
    return None


@router.post("")
async def upload_file(file: UploadFile = File(...), current=Depends(get_current_user)):
    ctype = file.content_type or "application/octet-stream"
    mb = _limit_mb(ctype)
    if mb is None:
        raise HTTPException(status_code=400, detail="Tipe berkas tidak didukung.")
    content = await file.read()
    max_bytes = min(mb * 1024 * 1024, storage.max_bytes)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Berkas terlalu besar (maksimum {max_bytes // (1024 * 1024)} MB).")
    mid = new_id()
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    try:
        path = await storage.put(f"{APP_NAME}/uploads/{current['id']}/{mid}.{ext}", content, ctype)
    except Exception:
        raise HTTPException(status_code=502, detail="Penyimpanan berkas sedang bermasalah. Coba lagi.")
    await db.media.insert_one({
        "id": mid, "owner_id": current["id"], "filename": file.filename, "content_type": ctype,
        "size": len(content), "provider": storage.name, "storage_path": path,
        "is_deleted": False, "created_at": iso(),
    })
    return {"id": mid, "url": f"/api/uploads/{mid}", "content_type": ctype,
            "filename": file.filename, "size": len(content)}


async def _bytes(doc):
    if doc["id"] in _cache:
        _cache.move_to_end(doc["id"])
        return _cache[doc["id"]]
    raw = await read_media(doc)
    _cache[doc["id"]] = raw
    if len(_cache) > CACHE_ITEMS:
        _cache.popitem(last=False)
    return raw


@router.get("/{media_id}")
async def get_file(media_id: str, request: Request):
    doc = await db.media.find_one({"id": media_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan.")
    raw = await _bytes(doc)
    ctype = doc.get("content_type", "application/octet-stream")
    headers = {"Cache-Control": "private, max-age=86400", "Accept-Ranges": "bytes",
               "Content-Disposition": f'inline; filename="{media_id}"'}
    rng = request.headers.get("range", "")
    if rng.startswith("bytes="):
        total = len(raw)
        s, _, e = rng[6:].split(",")[0].strip().partition("-")
        try:
            if s == "":
                start, end = max(0, total - int(e)), total - 1
            else:
                start, end = int(s), min(int(e) if e else total - 1, total - 1)
        except ValueError:
            start, end = 0, total - 1
        if start > end or start >= total:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{total}"})
        headers["Content-Range"] = f"bytes {start}-{end}/{total}"
        return Response(content=raw[start:end + 1], status_code=206, media_type=ctype, headers=headers)
    return Response(content=raw, media_type=ctype, headers=headers)
