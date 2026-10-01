from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from core.db import db
from core.common import new_id, clean, cleans
from core.security import get_current_user, iso

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

CATEGORIES = ["Makanan", "Minuman", "Sembako", "Jasa", "Fashion",
              "Elektronik", "Kerajinan", "Pertanian", "Kesehatan", "Lainnya"]


async def _region_ctx(current):
    """Return (rt_id, ancestors[]) for the user's current RT, or (None, [])."""
    mem = await db.memberships.find_one({"user_id": current["id"], "is_current": True})
    if not mem:
        return None, []
    rt_id = mem["rt_id"]
    region = await db.regions.find_one({"id": rt_id}, {"_id": 0})
    anc = (region.get("ancestors", []) if region else []) + [rt_id]
    return rt_id, anc


def _scope_ancestor(ancestors, scope):
    """Pick a scoping ancestor id based on requested scope breadth.
    ancestors ordered province->...->rt. village is index 3 if full tree.
    """
    if not ancestors:
        return None
    if scope == "all":
        return None
    # ancestors list: [PROV, REGENCY, DISTRICT, VILLAGE, RW, RT]
    idx = {"regency": 1, "district": 2, "village": 3, "rw": 4, "rt": 5}.get(scope, 1)
    return ancestors[idx] if len(ancestors) > idx else ancestors[-1]


def _public(m, viewer_id=None):
    if not m.get("phone_public") and m.get("owner_user_id") != viewer_id:
        m = {**m, "phone": ""}
    return m


async def _merchant_card(m, viewer_id=None):
    prod_count = await db.products.count_documents({"merchant_id": m["id"]})
    return {**_public(clean(m), viewer_id), "product_count": prod_count}


# ---------------- CATEGORIES ----------------
@router.get("/categories")
async def categories():
    return CATEGORIES


# ---------------- MERCHANT ----------------
class MerchantReq(BaseModel):
    name: str
    description: str = ""
    category: str = "Lainnya"
    phone: str = ""
    phone_public: bool = False
    address: str = ""
    hours: str = ""
    logo_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


@router.post("/merchants")
async def create_merchant(req: MerchantReq, current=Depends(get_current_user)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Nama usaha wajib diisi.")
    existing = await db.merchants.find_one({"owner_user_id": current["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Anda sudah memiliki toko.")
    rt_id, anc = await _region_ctx(current)
    doc = {"id": new_id(), "owner_user_id": current["id"], "name": req.name.strip(),
           "description": req.description, "category": req.category, "phone": req.phone,
           "phone_public": req.phone_public, "address": req.address, "hours": req.hours,
           "logo_url": req.logo_url, "lat": req.lat, "lng": req.lng,
           "region_id": rt_id, "ancestors": anc, "sponsored": False, "status": "ACTIVE",
           "created_at": iso(), "updated_at": iso()}
    await db.merchants.insert_one(doc)
    await db.social_profiles.update_one({"user_id": current["id"]}, {"$set": {"merchant_status": "ACTIVE"}})
    return clean(doc)


@router.get("/merchants/me")
async def my_merchant(current=Depends(get_current_user)):
    m = await db.merchants.find_one({"owner_user_id": current["id"]}, {"_id": 0})
    return m or None


@router.put("/merchants/me")
async def update_merchant(req: MerchantReq, current=Depends(get_current_user)):
    m = await db.merchants.find_one({"owner_user_id": current["id"]})
    if not m:
        raise HTTPException(status_code=404, detail="Anda belum memiliki toko.")
    upd = {"name": req.name.strip(), "description": req.description, "category": req.category,
           "phone": req.phone, "phone_public": req.phone_public, "address": req.address,
           "hours": req.hours, "logo_url": req.logo_url, "lat": req.lat, "lng": req.lng,
           "updated_at": iso()}
    await db.merchants.update_one({"id": m["id"]}, {"$set": upd})
    return {**clean(m), **upd}


@router.get("/merchants")
async def list_merchants(q: Optional[str] = None, category: Optional[str] = None,
                         scope: str = "regency", current=Depends(get_current_user)):
    query = {"status": "ACTIVE"}
    _, anc = await _region_ctx(current)
    sid = _scope_ancestor(anc, scope)
    if sid:
        query["ancestors"] = sid
    if category and category != "Semua":
        query["category"] = category
    if q:
        import re
        query["name"] = {"$regex": re.compile(re.escape(q), re.IGNORECASE)}
    rows = await db.merchants.find(query, {"_id": 0}).sort([("sponsored", -1), ("created_at", -1)]).to_list(200)
    return [await _merchant_card(m, current["id"]) for m in rows]


@router.get("/merchants/{mid}")
async def merchant_detail(mid: str, current=Depends(get_current_user)):
    m = await db.merchants.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Toko tidak ditemukan.")
    prods = await db.products.find({"merchant_id": mid}, {"_id": 0}).sort([("sponsored", -1), ("created_at", -1)]).to_list(200)
    prof = await db.social_profiles.find_one({"user_id": m["owner_user_id"]}, {"_id": 0})
    return {**_public(m, current["id"]), "products": cleans(prods), "owner_name": (prof or {}).get("display_name"),
            "is_owner": m["owner_user_id"] == current["id"]}


# ---------------- PRODUCTS ----------------
class ProductReq(BaseModel):
    name: str
    description: str = ""
    price: float = 0
    category: str = "Lainnya"
    image_url: Optional[str] = None
    available: bool = True


async def _my_merchant_or_403(current):
    m = await db.merchants.find_one({"owner_user_id": current["id"]})
    if not m:
        raise HTTPException(status_code=400, detail="Buat toko terlebih dahulu.")
    return m


@router.post("/products")
async def create_product(req: ProductReq, current=Depends(get_current_user)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Nama produk wajib diisi.")
    if req.price < 0:
        raise HTTPException(status_code=400, detail="Harga tidak valid.")
    m = await _my_merchant_or_403(current)
    doc = {"id": new_id(), "merchant_id": m["id"], "owner_user_id": current["id"],
           "name": req.name.strip(), "description": req.description, "price": req.price,
           "category": req.category, "image_url": req.image_url, "available": req.available,
           "sponsored": False, "region_id": m.get("region_id"), "ancestors": m.get("ancestors", []),
           "created_at": iso(), "updated_at": iso()}
    await db.products.insert_one(doc)
    return clean(doc)


@router.put("/products/{pid}")
async def update_product(pid: str, req: ProductReq, current=Depends(get_current_user)):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan.")
    if p["owner_user_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Bukan produk Anda.")
    upd = {"name": req.name.strip(), "description": req.description, "price": req.price,
           "category": req.category, "image_url": req.image_url, "available": req.available,
           "updated_at": iso()}
    await db.products.update_one({"id": pid}, {"$set": upd})
    return {**clean(p), **upd}


@router.delete("/products/{pid}")
async def delete_product(pid: str, current=Depends(get_current_user)):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan.")
    if p["owner_user_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Bukan produk Anda.")
    await db.products.delete_one({"id": pid})
    await db.saved_products.delete_many({"product_id": pid})
    return {"ok": True}


@router.get("/products")
async def list_products(q: Optional[str] = None, category: Optional[str] = None,
                        scope: str = "regency", merchant_id: Optional[str] = None,
                        current=Depends(get_current_user)):
    query = {"available": True}
    if merchant_id:
        query = {"merchant_id": merchant_id}
    else:
        _, anc = await _region_ctx(current)
        sid = _scope_ancestor(anc, scope)
        if sid:
            query["ancestors"] = sid
        if category and category != "Semua":
            query["category"] = category
        if q:
            import re
            query["name"] = {"$regex": re.compile(re.escape(q), re.IGNORECASE)}
    rows = await db.products.find(query, {"_id": 0}).sort([("sponsored", -1), ("created_at", -1)]).to_list(300)
    saved_ids = {s["product_id"] for s in await db.saved_products.find({"user_id": current["id"]}, {"_id": 0, "product_id": 1}).to_list(1000)}
    out = []
    for p in rows:
        merchant = await db.merchants.find_one({"id": p["merchant_id"]}, {"_id": 0, "name": 1, "logo_url": 1})
        out.append({**p, "merchant_name": (merchant or {}).get("name"),
                    "merchant_logo": (merchant or {}).get("logo_url"), "saved": p["id"] in saved_ids})
    return out


@router.post("/products/{pid}/save")
async def toggle_save(pid: str, current=Depends(get_current_user)):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan.")
    existing = await db.saved_products.find_one({"user_id": current["id"], "product_id": pid})
    if existing:
        await db.saved_products.delete_one({"user_id": current["id"], "product_id": pid})
        return {"saved": False}
    await db.saved_products.insert_one({"id": new_id(), "user_id": current["id"], "product_id": pid, "created_at": iso()})
    return {"saved": True}


@router.get("/saved")
async def saved_products(current=Depends(get_current_user)):
    ids = [s["product_id"] for s in await db.saved_products.find({"user_id": current["id"]}, {"_id": 0}).to_list(1000)]
    rows = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(1000)
    out = []
    for p in rows:
        merchant = await db.merchants.find_one({"id": p["merchant_id"]}, {"_id": 0, "name": 1})
        out.append({**p, "merchant_name": (merchant or {}).get("name"), "saved": True})
    return out


class ReportReq(BaseModel):
    reason: str


@router.post("/products/{pid}/report")
async def report_product(pid: str, req: ReportReq, current=Depends(get_current_user)):
    if not (req.reason or "").strip():
        raise HTTPException(status_code=400, detail="Alasan laporan wajib diisi.")
    await db.marketplace_reports.insert_one({
        "id": new_id(), "reporter": current["id"], "product_id": pid,
        "reason": req.reason, "status": "OPEN", "created_at": iso()})
    return {"ok": True}
