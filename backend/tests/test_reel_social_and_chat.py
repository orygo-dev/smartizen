"""Tests for reel comments, reel share-to-feed, and marketplace chat flow (two-user)."""
import os
import io
import random
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"
FIXTURE = "/app/tests/fixtures/sample_vertical.mp4"

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


# ---------- Setup: two wargas, A/B same RT; C different RT ----------
def test_00_setup_regions():
    provs = session.get(f"{API}/regions", params={"level": "PROVINCE"}, timeout=20).json()
    dki = next(p for p in provs if "DKI Jakarta" in p["name"])
    reg = next(x for x in session.get(f"{API}/regions", params={"level": "REGENCY", "parent_id": dki["id"]}).json()
               if "Jakarta Selatan" in x["name"])
    dist = next(x for x in session.get(f"{API}/regions", params={"level": "DISTRICT", "parent_id": reg["id"]}).json()
                if "Kebayoran Baru" in x["name"])
    vils = session.get(f"{API}/regions", params={"level": "VILLAGE", "parent_id": dist["id"]}).json()
    v_gandaria = next(v for v in vils if "Gandaria Utara" in v["name"])
    rws = session.get(f"{API}/regions", params={"level": "RW", "parent_id": v_gandaria["id"]}).json()
    rts_all = []
    for rw in rws:
        rts_all += session.get(f"{API}/regions", params={"level": "RT", "parent_id": rw["id"]}).json()
    S["rt_main"] = next(x["id"] for x in rts_all if x.get("status") == "ACTIVE")
    S["rt_other"] = next(x["id"] for x in rts_all if x.get("status") == "UNCLAIMED" and x["id"] != S["rt_main"])


def test_01_setup_three_wargas():
    for key, label, rt in (("A", "WargaA", "rt_main"), ("B", "WargaB", "rt_main"), ("C", "WargaC", "rt_other")):
        tok, _ = _register(label)
        S[f"tok_{key}"] = tok
        r = session.post(f"{API}/residents/membership", json={"rt_id": S[rt]},
                         headers=hdr(tok), timeout=20)
        assert r.status_code in (200, 201), r.text
        S[f"uid_{key}"] = session.get(f"{API}/auth/me", headers=hdr(tok)).json()["id"]


def test_02_upload_videos():
    for key in ("A",):
        with open(FIXTURE, "rb") as f:
            data = f.read()
        r = session.post(f"{API}/uploads",
                         files={"file": ("t.mp4", io.BytesIO(data), "video/mp4")},
                         headers=hdr(S[f"tok_{key}"]), timeout=60)
        assert r.status_code == 200
        S[f"video_{key}"] = r.json()["url"]


# ---------- REEL COMMENTS ----------
def test_10_create_reel():
    r = session.post(f"{API}/reels",
                     json={"media_url": S["video_A"], "caption": "TEST reel for comments", "privacy": "RT"},
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200, r.text
    S["reel"] = r.json()["id"]


def test_11_comment_empty_400():
    r = session.post(f"{API}/reels/{S['reel']}/comments",
                     json={"text": "   "}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 400, r.text


def test_12_comment_by_B_ok_increments_count():
    before = session.get(f"{API}/reels", headers=hdr(S["tok_A"])).json()
    before_count = next((x.get("comment_count", 0) for x in before if x["id"] == S["reel"]), 0)
    r = session.post(f"{API}/reels/{S['reel']}/comments",
                     json={"text": "TEST komentar B"}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["text"] == "TEST komentar B"
    assert body["can_delete"] is True
    S["comment_B"] = body["id"]
    after = session.get(f"{API}/reels", headers=hdr(S["tok_A"])).json()
    after_count = next((x.get("comment_count", 0) for x in after if x["id"] == S["reel"]), 0)
    assert after_count == before_count + 1


def test_13_comment_cross_rt_403():
    r = session.post(f"{API}/reels/{S['reel']}/comments",
                     json={"text": "cross rt should fail"}, headers=hdr(S["tok_C"]), timeout=20)
    assert r.status_code == 403, r.text


def test_14_list_comments_can_delete_flag():
    r = session.get(f"{API}/reels/{S['reel']}/comments", headers=hdr(S["tok_A"]))
    assert r.status_code == 200
    rows = r.json()
    # Owner A sees comment and has can_delete=True
    c = next(x for x in rows if x["id"] == S["comment_B"])
    assert c["can_delete"] is True
    # B is author -> can_delete=True
    r2 = session.get(f"{API}/reels/{S['reel']}/comments", headers=hdr(S["tok_B"]))
    c2 = next(x for x in r2.json() if x["id"] == S["comment_B"])
    assert c2["can_delete"] is True


def test_15_owner_got_notification_reel_comment():
    r = session.get(f"{API}/social/notifications", headers=hdr(S["tok_A"])).json()
    kinds = [x.get("type") or x.get("kind") for x in r.get("items", [])]
    assert "REEL_COMMENT" in kinds, kinds


def test_16_delete_comment_by_non_owner_403():
    # add a 2nd comment by B then try C to delete -> but C can't even see reel. Use A? A is reel owner can delete.
    # Use another user B's comment, try C -> 403
    r = session.delete(f"{API}/reels/{S['reel']}/comments/{S['comment_B']}",
                       headers=hdr(S["tok_C"]), timeout=20)
    assert r.status_code == 403, r.text


def test_17_delete_comment_by_reel_owner_ok():
    r = session.delete(f"{API}/reels/{S['reel']}/comments/{S['comment_B']}",
                       headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200
    # count decrements
    rr = session.get(f"{API}/reels", headers=hdr(S["tok_A"])).json()
    cnt = next((x.get("comment_count", 0) for x in rr if x["id"] == S["reel"]), 0)
    assert cnt == 0


# ---------- REEL SHARE ----------
def test_20_share_cross_rt_403():
    r = session.post(f"{API}/reels/{S['reel']}/share",
                     json={"text": "nope"}, headers=hdr(S["tok_C"]), timeout=20)
    assert r.status_code == 403, r.text


def test_21_share_ok_creates_feed_post():
    r = session.post(f"{API}/reels/{S['reel']}/share",
                     json={"text": "TEST share"}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["reel_id"] == S["reel"]
    assert j["text"] == "TEST share"
    S["share_post"] = j["id"]


def test_22_feed_embeds_reel_for_same_rt():
    r = session.get(f"{API}/social/feed", headers=hdr(S["tok_A"])).json()
    post = next(x for x in r if x["id"] == S["share_post"])
    assert "reel" in post and post["reel"].get("id") == S["reel"]
    assert post["reel"].get("media_url")


def test_23_feed_embeds_unavailable_for_cross_rt_viewer():
    r = session.get(f"{API}/social/feed", headers=hdr(S["tok_C"])).json()
    post = next((x for x in r if x["id"] == S["share_post"]), None)
    # Known issue: feed is not RT-filtered -> cross-rt user may see the post row, but reel must be {unavailable: True}
    if post is None:
        pytest.skip("Feed is RT-filtered now; cross-rt viewer doesn't see the post.")
    assert post.get("reel", {}).get("unavailable") is True


def test_24_owner_got_notification_reel_share():
    r = session.get(f"{API}/social/notifications", headers=hdr(S["tok_A"])).json()
    kinds = [x.get("type") or x.get("kind") for x in r.get("items", [])]
    assert "REEL_SHARE" in kinds, kinds


def test_25_share_requires_rt_membership():
    # Register a user without membership
    phone = f"0812{random.randint(10000000, 99999999)}"
    rr = session.post(f"{API}/auth/register", json={
        "phone": phone, "password": "Secret#2026", "full_name": "TEST NoRT"
    }, timeout=20)
    d = rr.json()
    tok = d["access_token"]
    session.post(f"{API}/auth/verify-otp", json={"code": d["dev_otp"]}, headers=hdr(tok))
    # No membership -> share should 400 (but also will be 403 if _visible fails first since no viewer_ctx)
    r = session.post(f"{API}/reels/{S['reel']}/share",
                     json={"text": "x"}, headers=hdr(tok), timeout=20)
    # Reel is RT-visibility, so a user with no RT also can't view -> 403.
    assert r.status_code in (400, 403), r.text


# ---------- CHAT MARKETPLACE FLOW (seller A, buyer B) ----------
def test_30_seller_creates_merchant():
    r = session.post(f"{API}/marketplace/merchants",
                     json={"name": "TEST Toko Chat", "category": "Makanan",
                           "phone": "081200001111", "phone_public": False,
                           "description": "TEST merchant for chat flow"},
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200, r.text
    S["merchant"] = r.json()["id"]


def test_31_seller_creates_product():
    r = session.post(f"{API}/marketplace/products",
                     json={"name": "TEST Nasi Uduk", "price": 15000, "category": "Makanan",
                           "description": "TEST produk"},
                     headers=hdr(S["tok_A"]), timeout=20)
    assert r.status_code == 200, r.text
    S["product"] = r.json()["id"]


def test_32_buyer_sees_product_in_marketplace():
    r = session.get(f"{API}/marketplace/products", params={"q": "TEST Nasi", "scope": "all"},
                    headers=hdr(S["tok_B"]), timeout=20).json()
    assert any(p["id"] == S["product"] for p in r), r


def test_33_buyer_saves_product_toggle():
    r = session.post(f"{API}/marketplace/products/{S['product']}/save",
                     headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200
    assert r.json()["saved"] is True
    r2 = session.get(f"{API}/marketplace/saved", headers=hdr(S["tok_B"])).json()
    assert any(x["id"] == S["product"] for x in r2)


def test_34_buyer_merchant_detail_phone_hidden():
    r = session.get(f"{API}/marketplace/merchants/{S['merchant']}",
                    headers=hdr(S["tok_B"]), timeout=20).json()
    assert r["phone"] == ""
    assert r["is_owner"] is False
    assert r["owner_name"]


def test_35_buyer_starts_chat_with_seller_and_sends_message():
    r = session.post(f"{API}/chat/conversations",
                     json={"peer_user_id": S["uid_A"]}, headers=hdr(S["tok_B"]), timeout=20)
    assert r.status_code == 200, r.text
    conv = r.json()
    S["conv"] = conv["id"]
    # Send msg
    mid = f"cmid-{int(time.time()*1000)}"
    r2 = session.post(f"{API}/chat/conversations/{S['conv']}/messages",
                      json={"text": "Saya mau beli TEST Nasi Uduk", "client_message_id": mid, "kind": "text"},
                      headers=hdr(S["tok_B"]), timeout=20)
    assert r2.status_code == 200, r2.text
    S["msg1"] = r2.json()["id"]


def test_36_seller_sees_unread_count_and_conversation():
    # Give a moment
    time.sleep(0.5)
    r = session.get(f"{API}/chat/unread-count", headers=hdr(S["tok_A"])).json()
    assert r["unread"] >= 1, r
    convs = session.get(f"{API}/chat/conversations", headers=hdr(S["tok_A"])).json()
    conv = next(c for c in convs if c["id"] == S["conv"])
    assert conv["unread"] >= 1
    assert conv["last_message"]


def test_37_seller_reads_and_replies():
    # Reading marks as read
    r = session.get(f"{API}/chat/conversations/{S['conv']}/messages",
                    headers=hdr(S["tok_A"])).json()
    assert any(m["id"] == S["msg1"] for m in r["messages"])
    mid = f"cmid-{int(time.time()*1000)}"
    r2 = session.post(f"{API}/chat/conversations/{S['conv']}/messages",
                      json={"text": "Siap, bisa diambil jam 7 pagi", "client_message_id": mid, "kind": "text"},
                      headers=hdr(S["tok_A"]), timeout=20)
    assert r2.status_code == 200
    S["msg2"] = r2.json()["id"]


def test_38_buyer_sees_reply_and_unread_cleared_for_seller():
    r = session.get(f"{API}/chat/unread-count", headers=hdr(S["tok_A"])).json()
    assert r["unread"] == 0
    # Buyer sees seller's reply
    r2 = session.get(f"{API}/chat/conversations/{S['conv']}/messages",
                     headers=hdr(S["tok_B"])).json()
    assert any(m["id"] == S["msg2"] for m in r2["messages"])


def test_39_umkm_nearby_shows_seller_shop_to_buyer():
    r = session.get(f"{API}/umkm/nearby", headers=hdr(S["tok_B"])).json()
    assert r["has_region"] is True
    all_ids = [c["id"] for c in r.get("nearby", [])] + [c["id"] for c in r.get("featured", [])]
    assert S["merchant"] in all_ids, r


# ---------- Cleanup ----------
def test_99_cleanup():
    try:
        session.delete(f"{API}/reels/{S.get('reel','')}", headers=hdr(S.get("tok_A", "")), timeout=10)
    except Exception:
        pass
    try:
        session.delete(f"{API}/marketplace/products/{S.get('product','')}", headers=hdr(S.get("tok_A", "")), timeout=10)
    except Exception:
        pass
