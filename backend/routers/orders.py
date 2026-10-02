"""Simple order requests from buyer to UMKM seller (no payment; settled directly with seller)."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from core.db import db
from core.common import new_id, notify
from core.security import get_current_user, iso

router = APIRouter(prefix="/api/marketplace/orders", tags=["orders"])

SELLER_MOVES = {"PENDING": {"ACCEPTED", "REJECTED"}, "ACCEPTED": {"COMPLETED", "REJECTED"}}
BUYER_MOVES = {"PENDING": {"CANCELLED"}}
STATUS_TEXT = {"ACCEPTED": "diterima", "REJECTED": "ditolak", "COMPLETED": "selesai", "CANCELLED": "dibatalkan pembeli"}


class Item(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=99)


class OrderReq(BaseModel):
    merchant_id: str
    items: List[Item] = Field(min_length=1, max_length=20)
    note: str = Field(default="", max_length=500)


async def _name(uid):
    p = await db.social_profiles.find_one({"user_id": uid}, {"_id": 0, "display_name": 1})
    return (p or {}).get("display_name") or "Warga"


@router.post("")
async def create_order(req: OrderReq, current=Depends(get_current_user)):
    m = await db.merchants.find_one({"id": req.merchant_id, "status": "ACTIVE"}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Toko tidak ditemukan.")
    if m["owner_user_id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat memesan dari toko sendiri.")
    ids = [i.product_id for i in req.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Produk duplikat dalam pesanan.")
    prods = {p["id"]: p for p in await db.products.find({"id": {"$in": ids}, "merchant_id": m["id"]}, {"_id": 0}).to_list(20)}
    lines = []
    for i in req.items:
        p = prods.get(i.product_id)
        if not p:
            raise HTTPException(status_code=400, detail="Produk tidak ditemukan di toko ini.")
        if not p.get("available", True):
            raise HTTPException(status_code=400, detail=f"{p['name']} sedang habis.")
        lines.append({"product_id": p["id"], "name": p["name"], "price": p["price"], "qty": i.qty,
                      "subtotal": p["price"] * i.qty, "image_url": p.get("image_url")})
    doc = {"id": new_id(), "merchant_id": m["id"], "merchant_name": m["name"], "seller_id": m["owner_user_id"],
           "buyer_id": current["id"], "buyer_name": await _name(current["id"]), "items": lines,
           "total": sum(x["subtotal"] for x in lines), "note": req.note.strip(), "status": "PENDING",
           "history": [{"status": "PENDING", "by": current["id"], "at": iso()}], "created_at": iso(), "updated_at": iso()}
    await db.orders.insert_one(doc)
    summary = ", ".join(f"{x['qty']}x {x['name']}" for x in lines)
    await notify(m["owner_user_id"], "ORDER_NEW", "Pesanan baru masuk", f"{doc['buyer_name']}: {summary}"[:160],
                 "/app/pesanan?tab=masuk", doc["id"])
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_orders(role: str = "buyer", current=Depends(get_current_user)):
    q = {"seller_id": current["id"]} if role == "seller" else {"buyer_id": current["id"]}
    return await db.orders.find(q, {"_id": 0, "history": 0}).sort("created_at", -1).to_list(200)


async def _party_or_403(order_id, current):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan.")
    if current["id"] not in (o["buyer_id"], o["seller_id"]):
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda.")
    return o


@router.get("/{order_id}")
async def get_order(order_id: str, current=Depends(get_current_user)):
    return await _party_or_403(order_id, current)


class StatusReq(BaseModel):
    status: str


@router.post("/{order_id}/status")
async def update_status(order_id: str, req: StatusReq, current=Depends(get_current_user)):
    o = await _party_or_403(order_id, current)
    is_seller = current["id"] == o["seller_id"]
    moves = (SELLER_MOVES if is_seller else BUYER_MOVES).get(o["status"], set())
    if req.status not in moves:
        raise HTTPException(status_code=400, detail="Perubahan status pesanan tidak diizinkan.")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": req.status, "updated_at": iso()},
                                                  "$push": {"history": {"status": req.status, "by": current["id"], "at": iso()}}})
    other = o["buyer_id"] if is_seller else o["seller_id"]
    await notify(other, "ORDER_STATUS", f"Pesanan {STATUS_TEXT[req.status]}",
                 f"Pesanan di {o['merchant_name']} {STATUS_TEXT[req.status]}.",
                 "/app/pesanan" if is_seller else "/app/pesanan?tab=masuk", order_id)
    return {**o, "status": req.status}
