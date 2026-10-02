"""Iteration 5 tests: multi-item orders & seller pending-count badge."""
import os
import random
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"
ADMIN_ID = os.environ.get("ADMIN_EMAIL", "antot251@gmail.com")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "Sz-p8dRbg3BvJo5Ed9OwVY")

S = {}
session = requests.Session()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _register(name_prefix):
    phone = f"0812{random.randint(10000000, 99999999)}"
    r = session.post(f"{API}/auth/register", json={
        "phone": phone, "password": "Secret#2026", "full_name": f"TEST {name_prefix}"
    }, timeout=20)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    tok = d["access_token"]
    session.post(f"{API}/auth/verify-otp", json={"code": d["dev_otp"]}, headers=hdr(tok), timeout=20)
    return tok, phone


def _join(tok, rt_id):
    r = session.post(f"{API}/residents/membership", json={"rt_id": rt_id}, headers=hdr(tok), timeout=20)
    assert r.status_code in (200, 201), r.text


def test_00_setup():
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200
    S["admin"] = r.json()["access_token"]
    provs = session.get(f"{API}/regions", params={"level": "PROVINCE"}, timeout=20).json()
    dki = next(p for p in provs if "DKI Jakarta" in p["name"])
    reg = next(x for x in session.get(f"{API}/regions", params={"level": "REGENCY", "parent_id": dki["id"]}).json() if "Jakarta Selatan" in x["name"])
    dist = next(x for x in session.get(f"{API}/regions", params={"level": "DISTRICT", "parent_id": reg["id"]}).json() if "Kebayoran Baru" in x["name"])
    vils = session.get(f"{API}/regions", params={"level": "VILLAGE", "parent_id": dist["id"]}).json()
    gandaria = next(v for v in vils if "Gandaria Utara" in v["name"])
    rts = []
    for rw in session.get(f"{API}/regions", params={"level": "RW", "parent_id": gandaria["id"]}).json():
        rts += session.get(f"{API}/regions", params={"level": "RT", "parent_id": rw["id"]}).json()
    assert rts
    S["rt"] = rts[0]["id"]
    # Seller A + Buyer B same RT; Third-party C from a different RT in same village (to probe pending-count isolation)
    S["rt2"] = next((x["id"] for x in rts if x["id"] != S["rt"]), rts[0]["id"])
    for key, label, rt in (("A", "SellerA", "rt"), ("B", "BuyerB", "rt"), ("C", "OtherC", "rt2")):
        tok, _ = _register(label)
        S[f"tok_{key}"] = tok
        _join(tok, S[rt])
        S[f"uid_{key}"] = session.get(f"{API}/auth/me", headers=hdr(tok)).json()["id"]
    # Seller A creates merchant + 3 products
    r = session.post(f"{API}/marketplace/merchants", json={
        "name": "TEST Toko Cart", "category": "Makanan", "phone": "081200009999",
        "phone_public": False, "description": "TEST"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    S["merchant_A"] = r.json()["id"]
    for i, price in enumerate([10000, 15000, 25000]):
        r = session.post(f"{API}/marketplace/products", json={
            "name": f"TEST Prod {i+1}", "price": price, "category": "Makanan", "description": "TEST"},
            headers=hdr(S["tok_A"]), timeout=20)
        assert r.status_code == 200
        S[f"p{i+1}"] = r.json()["id"]
    # Other seller C with their own merchant+product
    r = session.post(f"{API}/marketplace/merchants", json={
        "name": "TEST Toko Other", "category": "Makanan", "phone": "081200008888",
        "phone_public": False, "description": "TEST"}, headers=hdr(S["tok_C"]), timeout=20)
    assert r.status_code == 200
    S["merchant_C"] = r.json()["id"]
    r = session.post(f"{API}/marketplace/products", json={
        "name": "TEST Prod Other", "price": 5000, "category": "Makanan"},
        headers=hdr(S["tok_C"]), timeout=20)
    S["p_other"] = r.json()["id"]


# ---------- Pending count ----------
def test_10_pending_count_zero_initially():
    r = session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    assert r.json() == {"pending": 0}


def test_11_pending_count_buyer_side_zero():
    # Buyer with no incoming pending orders must see 0 (they're not seller of anything pending)
    r = session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_B"]), timeout=20)
    assert r.json()["pending"] == 0


# ---------- Multi-item order creation ----------
def test_20_create_multi_item_order_totals():
    items = [
        {"product_id": S["p1"], "qty": 2},   # 10000 * 2 = 20000
        {"product_id": S["p2"], "qty": 1},   # 15000
        {"product_id": S["p3"], "qty": 3},   # 25000 * 3 = 75000
    ]
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"], "items": items, "note": "TEST multi"
    }, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200, r.text
    o = r.json()
    S["order_multi"] = o["id"]
    assert o["status"] == "PENDING"
    by_pid = {x["product_id"]: x for x in o["items"]}
    assert by_pid[S["p1"]]["subtotal"] == 20000 and by_pid[S["p1"]]["price"] == 10000
    assert by_pid[S["p2"]]["subtotal"] == 15000
    assert by_pid[S["p3"]]["subtotal"] == 75000
    assert o["total"] == 20000 + 15000 + 75000
    assert len(o["items"]) == 3


def test_21_pending_count_one_for_seller_after_order():
    r = session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"]), timeout=20)
    assert r.json()["pending"] == 1


def test_22_pending_count_buyer_still_zero():
    # Buyer with outgoing pending order (acting as buyer, not seller) must still see 0
    r = session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_B"]), timeout=20)
    assert r.json()["pending"] == 0


def test_23_other_user_pending_count_zero():
    r = session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_C"]), timeout=20)
    assert r.json()["pending"] == 0


# ---------- Cross-merchant rejection ----------
def test_30_item_from_another_merchant_400():
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"],
        "items": [
            {"product_id": S["p1"], "qty": 1},
            {"product_id": S["p_other"], "qty": 1},
        ],
    }, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400, r.text


# ---------- Pending-count transitions ----------
def test_40_pending_drops_after_seller_accepts():
    r = session.post(f"{API}/marketplace/orders/{S['order_multi']}/status",
                     json={"status": "ACCEPTED"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    r = session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"]), timeout=20)
    assert r.json()["pending"] == 0


def test_41_pending_drops_after_seller_rejects_new_order():
    # new pending order
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"],
        "items": [{"product_id": S["p1"], "qty": 1}]
    }, headers=hdr(S["tok_B"]), timeout=20)
    oid = r.json()["id"]
    assert session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"])).json()["pending"] == 1
    r = session.post(f"{API}/marketplace/orders/{oid}/status",
                     json={"status": "REJECTED"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    assert session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"])).json()["pending"] == 0


def test_42_pending_drops_after_buyer_cancels():
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"],
        "items": [{"product_id": S["p2"], "qty": 1}]
    }, headers=hdr(S["tok_B"]), timeout=20)
    oid = r.json()["id"]
    assert session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"])).json()["pending"] == 1
    r = session.post(f"{API}/marketplace/orders/{oid}/status",
                     json={"status": "CANCELLED"}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200
    assert session.get(f"{API}/marketplace/orders/pending-count", headers=hdr(S["tok_A"])).json()["pending"] == 0


# ---------- Multi-item edge cases ----------
def test_50_duplicate_product_ids_still_rejected():
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"],
        "items": [
            {"product_id": S["p1"], "qty": 2},
            {"product_id": S["p1"], "qty": 3},
        ],
    }, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400


def test_51_max_20_items_cap_422():
    # 21 items trips max_length=20
    items = [{"product_id": S["p1"], "qty": 1}] * 21
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"], "items": items
    }, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 422


def test_52_empty_items_422():
    r = session.post(f"{API}/marketplace/orders", json={
        "merchant_id": S["merchant_A"], "items": []
    }, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 422


# ---------- Cleanup ----------
def test_99_cleanup():
    try:
        for pid in (S.get("p1"), S.get("p2"), S.get("p3")):
            if pid:
                session.delete(f"{API}/marketplace/products/{pid}", headers=hdr(S["tok_A"]), timeout=10)
        if S.get("p_other"):
            session.delete(f"{API}/marketplace/products/{S['p_other']}", headers=hdr(S["tok_C"]), timeout=10)
    except Exception:
        pass
