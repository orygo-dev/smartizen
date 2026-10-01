import uuid
from core.db import db
from core.security import iso


def new_id():
    return str(uuid.uuid4())


def clean(doc: dict):
    """Strip Mongo _id, keep string id field."""
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def cleans(docs):
    return [clean(d) for d in docs]


async def audit(actor_id, action, target_type=None, target_id=None, region_id=None, reason=None, meta=None):
    await db.audit_logs.insert_one({
        "id": new_id(),
        "actor_id": actor_id,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "region_id": region_id,
        "reason": reason,
        "meta": meta or {},
        "created_at": iso(),
    })


async def notify(user_id, ntype, title, body, deep_link=None, entity_id=None):
    await db.notifications.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "entity_id": entity_id,
        "deep_link": deep_link,
        "read_at": None,
        "created_at": iso(),
    })


# Human-friendly Indonesian status labels (never show raw enums to users)
STATUS_LABELS = {
    "DRAFT": "Draf",
    "PENDING_REVIEW": "Menunggu Verifikasi",
    "NEED_REVISION": "Perlu Revisi",
    "VERIFIED": "Terverifikasi",
    "REJECTED": "Ditolak",
    "CONFLICT": "Konflik Klaim",
    "SUSPENDED": "Dinonaktifkan",
    "PENDING": "Menunggu",
    "PENDING_RT_VERIFICATION": "Menunggu RT Bergabung",
    "ACTIVE": "Aktif",
    "ENDED": "Berakhir",
    "SUBMITTED": "Terkirim",
    "ASSIGNED": "Ditugaskan",
    "IN_PROGRESS": "Sedang Diproses",
    "RESOLVED": "Selesai",
    "PAID": "Lunas",
    "UNPAID": "Belum Bayar",
    "UNCLAIMED": "Belum Bergabung",
}
