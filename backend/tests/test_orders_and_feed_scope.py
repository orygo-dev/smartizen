"""Tests for RT-scoped feed and marketplace order requests (iteration 4)."""
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
    session.post(f"{API}/auth/verify-otp", json={"code": d["dev_otp"]},
                 headers=hdr(tok), timeout=20)
    return tok, phone


def _join_rt(tok, rt_id):
    r = session.post(f"{API}/residents/membership", json={"rt_id": rt_id},
                     headers=hdr(tok), timeout=20)
    assert r.status_code in (200, 201), r.text


# ---------- Setup: find 3 RTs: two in Gandaria Utara (A same village as B, different RTs),
#            and one in Kramat Pela (C in different village) ----------
def test_00_admin_login():
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    S["admin"] = r.json()["access_token"]


def test_01_pick_regions_cross_village():
    provs = session.get(f"{API}/regions", params={"level": "PROVINCE"}, timeout=20).json()
    dki = next(p for p in provs if "DKI Jakarta" in p["name"])
    reg = next(x for x in session.get(f"{API}/regions", params={"level": "REGENCY", "parent_id": dki["id"]}).json()
               if "Jakarta Selatan" in x["name"])
    dist = next(x for x in session.get(f"{API}/regions", params={"level": "DISTRICT", "parent_id": reg["id"]}).json()
                if "Kebayoran Baru" in x["name"])
    vils = session.get(f"{API}/regions", params={"level": "VILLAGE", "parent_id": dist["id"]}).json()
    v_gandaria = next(v for v in vils if "Gandaria Utara" in v["name"])
    v_kramat = next(v for v in vils if "Kramat" in v["name"])
    S["village_gandaria"] = v_gandaria["id"]
    S["village_kramat"] = v_kramat["id"]
    # Gandaria Utara: pick two RTs (A, B) different RTs same village
    rts_g = []
    for rw in session.get(f"{API}/regions", params={"level": "RW", "parent_id": v_gandaria["id"]}).json():
        rts_g += session.get(f"{API}/regions", params={"level": "RT", "parent_id": rw["id"]}).json()
    assert len(rts_g) >= 2
    S["rt_A"] = rts_g[0]["id"]
    S["rt_B"] = next(x["id"] for x in rts_g if x["id"] != S["rt_A"])
    # Kramat Pela: pick one RT (C)
    rts_k = []
    for rw in session.get(f"{API}/regions", params={"level": "RW", "parent_id": v_kramat["id"]}).json():
        rts_k += session.get(f"{API}/regions", params={"level": "RT", "parent_id": rw["id"]}).json()
    assert rts_k
    S["rt_C"] = rts_k[0]["id"]


def test_02_setup_three_wargas():
    for key, label, rt in (("A", "FeedA", "rt_A"), ("B", "FeedB", "rt_B"), ("C", "FeedC", "rt_C")):
        tok, _ = _register(label)
        S[f"tok_{key}"] = tok
        _join_rt(tok, S[rt])
        S[f"uid_{key}"] = session.get(f"{API}/auth/me", headers=hdr(tok)).json()["id"]


# ---------- Feed scoping ----------
def test_10_create_posts_in_each_rt():
    for key in ("A", "B", "C"):
        r = session.post(f"{API}/social/feed",
                         json={"text": f"TEST post {key}", "category": "Umum"},
                         headers=hdr(S[f"tok_{key}"]), timeout=20)
        assert r.status_code == 200, r.text
        S[f"post_{key}"] = r.json()["id"]
        # rt_name should be present when fetched via list_feed; author sees own regardless


def test_11_feed_village_scope_sees_same_village_posts_only():
    rows = session.get(f"{API}/social/feed", headers=hdr(S["tok_A"]), timeout=20).json()
    ids = [p["id"] for p in rows]
    assert S["post_A"] in ids and S["post_B"] in ids
    assert S["post_C"] not in ids
    # rt_name formatted
    pa = next(p for p in rows if p["id"] == S["post_A"])
    assert pa.get("rt_name") and "RT" in pa["rt_name"] and "RW" in pa["rt_name"]


def test_12_feed_rt_scope_sees_only_own_rt():
    rows = session.get(f"{API}/social/feed", params={"scope": "rt"},
                       headers=hdr(S["tok_A"]), timeout=20).json()
    ids = [p["id"] for p in rows]
    assert S["post_A"] in ids
    assert S["post_B"] not in ids
    assert S["post_C"] not in ids


def test_13_cross_village_viewer_cannot_see_other_village_post():
    rows = session.get(f"{API}/social/feed", headers=hdr(S["tok_C"]), timeout=20).json()
    ids = [p["id"] for p in rows]
    assert S["post_C"] in ids
    assert S["post_A"] not in ids
    assert S["post_B"] not in ids


def test_14_rt_id_param_outside_scope_403():
    r = session.get(f"{API}/social/feed", params={"rt_id": S["rt_C"]},
                    headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 403, r.text


def test_15_rt_id_param_own_rt_ok():
    r = session.get(f"{API}/social/feed", params={"rt_id": S["rt_A"]},
                    headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert S["post_A"] in ids
    assert S["post_B"] not in ids


def test_16_admin_sees_all_posts():
    rows = session.get(f"{API}/social/feed", headers=hdr(S["admin"]), timeout=20).json()
    ids = [p["id"] for p in rows]
    assert S["post_A"] in ids and S["post_B"] in ids and S["post_C"] in ids


def test_17_like_out_of_area_403():
    r = session.post(f"{API}/social/feed/{S['post_C']}/like",
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 403, r.text


def test_18_list_comments_out_of_area_403():
    r = session.get(f"{API}/social/feed/{S['post_C']}/comments",
                    headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 403


def test_19_post_comment_out_of_area_403():
    r = session.post(f"{API}/social/feed/{S['post_C']}/comments",
                     json={"text": "hi"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 403


def test_1a_empty_comment_in_area_400():
    r = session.post(f"{API}/social/feed/{S['post_A']}/comments",
                     json={"text": "   "}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400


# ---------- Orders ----------
def test_20_seller_creates_merchant_and_product():
    r = session.post(f"{API}/marketplace/merchants",
                     json={"name": "TEST Toko Order", "category": "Makanan",
                           "phone": "081200003333", "phone_public": False,
                           "description": "TEST merchant for orders"},
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200, r.text
    S["merchant_A"] = r.json()["id"]
    r = session.post(f"{API}/marketplace/products",
                     json={"name": "TEST Nasi Order", "price": 20000, "category": "Makanan",
                           "description": "TEST"},
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200, r.text
    S["product_A"] = r.json()["id"]


def test_21_create_order_ok():
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 2}],
                           "note": "TEST please pack"},
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200, r.text
    o = r.json()
    S["order_1"] = o["id"]
    assert o["status"] == "PENDING"
    assert o["total"] == 40000
    assert o["items"][0]["subtotal"] == 40000
    assert o["items"][0]["price"] == 20000
    assert o["buyer_id"] == S["uid_B"]
    assert o["seller_id"] == S["uid_A"]


def test_22_seller_got_order_new_notification():
    r = session.get(f"{API}/social/notifications", headers=hdr(S["tok_A"]), timeout=20).json()
    kinds = [x.get("type") or x.get("kind") for x in r.get("items", [])]
    assert "ORDER_NEW" in kinds, kinds


def test_23_cannot_order_from_own_shop():
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 1}]},
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 400, r.text


def test_24_duplicate_product_ids_400():
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 1},
                                     {"product_id": S["product_A"], "qty": 2}]},
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400


def test_25_qty_zero_422():
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 0}]},
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 422


def test_26_qty_100_422():
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 100}]},
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 422


def test_27_product_from_another_merchant_400():
    # C creates merchant+product, then B tries to order it from A's merchant
    r = session.post(f"{API}/marketplace/merchants",
                     json={"name": "TEST Toko C", "category": "Makanan",
                           "phone": "08120000", "phone_public": False, "description": "TEST C"},
                     headers=hdr(S["tok_C"]), timeout=20)
    S["merchant_C"] = r.json()["id"]
    rp = session.post(f"{API}/marketplace/products",
                      json={"name": "TEST C Prod", "price": 1000, "category": "Makanan"},
                      headers=hdr(S["tok_C"]), timeout=20)
    S["product_C"] = rp.json()["id"]
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_C"], "qty": 1}]},
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400, r.text


def test_28_unavailable_product_400():
    # Mark product unavailable (full payload required by ProductReq)
    payload = {"name": "TEST Nasi Order", "price": 20000, "category": "Makanan",
               "description": "TEST", "available": False}
    r = session.put(f"{API}/marketplace/products/{S['product_A']}",
                    json=payload, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code in (200, 204), r.text
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 1}]},
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400
    # restore
    payload["available"] = True
    session.put(f"{API}/marketplace/products/{S['product_A']}",
                json=payload, headers=hdr(S["tok_A"]), timeout=20)


def test_29_list_orders_role_buyer_seller():
    rb = session.get(f"{API}/marketplace/orders", params={"role": "buyer"},
                     headers=hdr(S["tok_B"]), timeout=20).json()
    assert any(o["id"] == S["order_1"] for o in rb)
    rs = session.get(f"{API}/marketplace/orders", params={"role": "seller"},
                     headers=hdr(S["tok_A"]), timeout=20).json()
    assert any(o["id"] == S["order_1"] for o in rs)
    # Buyer under role=seller should NOT see it
    rsb = session.get(f"{API}/marketplace/orders", params={"role": "seller"},
                      headers=hdr(S["tok_B"]), timeout=20).json()
    assert not any(o["id"] == S["order_1"] for o in rsb)


def test_2a_get_order_non_party_403():
    r = session.get(f"{API}/marketplace/orders/{S['order_1']}",
                    headers=hdr(S["tok_C"]), timeout=20)
    assert r.status_code == 403


def test_2b_buyer_cannot_set_accepted_400():
    r = session.post(f"{API}/marketplace/orders/{S['order_1']}/status",
                     json={"status": "ACCEPTED"}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400


def test_2c_non_party_status_403():
    r = session.post(f"{API}/marketplace/orders/{S['order_1']}/status",
                     json={"status": "ACCEPTED"}, headers=hdr(S["tok_C"]), timeout=20)
    assert r.status_code == 403


def test_2d_seller_pending_to_accepted():
    r = session.post(f"{API}/marketplace/orders/{S['order_1']}/status",
                     json={"status": "ACCEPTED"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ACCEPTED"


def test_2e_buyer_cannot_cancel_accepted_400():
    r = session.post(f"{API}/marketplace/orders/{S['order_1']}/status",
                     json={"status": "CANCELLED"}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400


def test_2f_seller_accepted_to_completed():
    r = session.post(f"{API}/marketplace/orders/{S['order_1']}/status",
                     json={"status": "COMPLETED"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    # verify persistence
    g = session.get(f"{API}/marketplace/orders/{S['order_1']}",
                    headers=hdr(S["tok_B"]), timeout=20).json()
    assert g["status"] == "COMPLETED"


def test_2g_cannot_change_after_completed():
    r = session.post(f"{API}/marketplace/orders/{S['order_1']}/status",
                     json={"status": "REJECTED"}, headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 400


def test_2h_buyer_cancel_new_pending_order():
    r = session.post(f"{API}/marketplace/orders",
                     json={"merchant_id": S["merchant_A"],
                           "items": [{"product_id": S["product_A"], "qty": 1}]},
                     headers=hdr(S["tok_B"]), timeout=20)
    oid = r.json()["id"]
    S["order_2"] = oid
    rc = session.post(f"{API}/marketplace/orders/{oid}/status",
                      json={"status": "CANCELLED"}, headers=hdr(S["tok_B"]), timeout=20)
    assert rc.status_code == 200
    assert rc.json()["status"] == "CANCELLED"


def test_2i_seller_notified_on_cancel():
    r = session.get(f"{API}/social/notifications", headers=hdr(S["tok_A"]), timeout=20).json()
    kinds = [x.get("type") or x.get("kind") for x in r.get("items", [])]
    assert "ORDER_STATUS" in kinds


# ---------- Cleanup ----------
def test_99_cleanup():
    try:
        for pid in (S.get("product_A"), S.get("product_C")):
            if pid:
                session.delete(f"{API}/marketplace/products/{pid}",
                               headers=hdr(S.get("tok_A") if pid == S.get("product_A") else S.get("tok_C")),
                               timeout=10)
    except Exception:
        pass
