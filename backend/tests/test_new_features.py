"""Tests for new features: uploads, stories (video+music+privacy), reels, UMKM nearby/featured, marketplace phone hiding."""
import os
import io
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
ADMIN_ID = os.environ["ADMIN_EMAIL"]
ADMIN_PW = os.environ["ADMIN_PASSWORD"]
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


# ---------- Setup: admin, 2 wargas in different RTs, 1 RT_HEAD ----------
def test_00_setup_admin_login():
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    S["admin"] = r.json()["access_token"]


def test_00_old_admin_password_rejected():
    r = session.post(f"{API}/auth/login",
                     json={"identifier": ADMIN_ID, "password": "Smartizen#2026"}, timeout=20)
    assert r.status_code == 401, r.text


def test_01_setup_regions_two_rts():
    # DKI Jakarta -> Jakarta Selatan -> Kebayoran Baru -> Gandaria Utara
    provs = session.get(f"{API}/regions", params={"level": "PROVINCE"}, timeout=20).json()
    dki = next(p for p in provs if "DKI Jakarta" in p["name"])
    reg = next(x for x in session.get(f"{API}/regions", params={"level": "REGENCY", "parent_id": dki["id"]}).json()
               if "Jakarta Selatan" in x["name"])
    dist = next(x for x in session.get(f"{API}/regions", params={"level": "DISTRICT", "parent_id": reg["id"]}).json()
                if "Kebayoran Baru" in x["name"])
    vils = session.get(f"{API}/regions", params={"level": "VILLAGE", "parent_id": dist["id"]}).json()
    v_gandaria = next(v for v in vils if "Gandaria Utara" in v["name"])
    v_kramat = next((v for v in vils if "Kramat" in v["name"]), None)
    S["village_gandaria"] = v_gandaria["id"]
    S["village_kramat"] = (v_kramat or {}).get("id")
    # pick two different RTs under Gandaria Utara
    rws = session.get(f"{API}/regions", params={"level": "RW", "parent_id": v_gandaria["id"]}).json()
    rts_all = []
    for rw in rws:
        rts_all += session.get(f"{API}/regions", params={"level": "RT", "parent_id": rw["id"]}).json()
    # pick an ACTIVE and an UNCLAIMED for cross-RT
    S["rt_a"] = next(x["id"] for x in rts_all if x.get("status") == "ACTIVE")
    S["rt_b"] = next(x["id"] for x in rts_all if x.get("status") == "UNCLAIMED" and x["id"] != S["rt_a"])
    assert S["rt_a"] != S["rt_b"]


def test_02_setup_two_wargas():
    tokA, _ = _register("WargaA")
    tokB, _ = _register("WargaB")
    S["warga_a"] = tokA
    S["warga_b"] = tokB
    # join different RTs
    rA = session.post(f"{API}/residents/membership", json={"rt_id": S["rt_a"]},
                      headers=hdr(tokA), timeout=20)
    assert rA.status_code in (200, 201), rA.text
    rB = session.post(f"{API}/residents/membership", json={"rt_id": S["rt_b"]},
                      headers=hdr(tokB), timeout=20)
    assert rB.status_code in (200, 201), rB.text
    # self id
    S["warga_a_id"] = session.get(f"{API}/auth/me", headers=hdr(tokA)).json()["id"]
    S["warga_b_id"] = session.get(f"{API}/auth/me", headers=hdr(tokB)).json()["id"]


# ---------- Uploads ----------
def test_10_upload_video_mp4_ok():
    with open(FIXTURE, "rb") as f:
        data = f.read()
    r = session.post(f"{API}/uploads",
                     files={"file": ("test.mp4", io.BytesIO(data), "video/mp4")},
                     headers=hdr(S["warga_a"]), timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["content_type"].startswith("video/")
    assert j["url"].startswith("/api/uploads/")
    S["video_a_url"] = j["url"]
    S["video_a_id"] = j["id"]


def test_11_upload_video_warga_b():
    with open(FIXTURE, "rb") as f:
        data = f.read()
    r = session.post(f"{API}/uploads",
                     files={"file": ("test.mp4", io.BytesIO(data), "video/mp4")},
                     headers=hdr(S["warga_b"]), timeout=60)
    assert r.status_code == 200, r.text
    S["video_b_url"] = r.json()["url"]


def test_12_upload_disallowed_type():
    r = session.post(f"{API}/uploads",
                     files={"file": ("test.exe", io.BytesIO(b"xx"), "application/octet-stream")},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 400


def test_13_get_upload_range_206():
    r = session.get(f"{BASE}{S['video_a_url']}",
                    headers={**hdr(S["warga_a"]), "Range": "bytes=0-99"}, timeout=20)
    assert r.status_code == 206, r.status_code
    assert "Content-Range" in r.headers


def test_14_get_upload_full():
    r = session.get(f"{BASE}{S['video_a_url']}", headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("video/")


# ---------- Stories ----------
def test_20_story_text_rt():
    r = session.post(f"{API}/social/stories",
                     json={"media_type": "text", "text": "TEST story A", "privacy": "RT"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200, r.text
    S["story_a_text"] = r.json()["id"]


def test_21_story_video_requires_own_media():
    # warga_a tries using warga_b's video -> 400
    r = session.post(f"{API}/social/stories",
                     json={"media_type": "video", "media_url": S["video_b_url"], "privacy": "RT"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 400, r.text


def test_22_story_video_with_music_ok():
    r = session.post(f"{API}/social/stories",
                     json={"media_type": "video", "media_url": S["video_a_url"],
                           "music": {"title": "Pagi", "url": "/music/pagi-ceria.wav"},
                           "privacy": "RT"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["music"]["url"] == "/music/pagi-ceria.wav"
    S["story_a_video"] = body["id"]


def test_23_story_invalid_music():
    r = session.post(f"{API}/social/stories",
                     json={"media_type": "text", "text": "x",
                           "music": {"title": "Bad", "url": "https://evil.com/x.wav"}, "privacy": "RT"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 400


def test_24_story_cross_rt_invisible():
    # warga_b (different RT) should NOT see warga_a's RT stories
    rows = session.get(f"{API}/social/stories", headers=hdr(S["warga_b"]), timeout=20).json()
    ids_seen = {it["id"] for g in rows for it in g["items"]}
    assert S["story_a_text"] not in ids_seen
    assert S["story_a_video"] not in ids_seen


def test_25_story_own_visible():
    rows = session.get(f"{API}/social/stories", headers=hdr(S["warga_a"]), timeout=20).json()
    ids = {it["id"] for g in rows for it in g["items"]}
    assert S["story_a_text"] in ids
    assert S["story_a_video"] in ids
    # has_video flag for own group
    own_group = next(g for g in rows if g["author_id"] == S["warga_a_id"])
    assert own_group["has_video"] is True


def test_26_view_invisible_story_403():
    r = session.post(f"{API}/social/stories/{S['story_a_text']}/view",
                     headers=hdr(S["warga_b"]), timeout=20)
    assert r.status_code == 403


def test_27_delete_others_story_403():
    r = session.delete(f"{API}/social/stories/{S['story_a_text']}",
                       headers=hdr(S["warga_b"]), timeout=20)
    assert r.status_code == 403


def test_28_delete_own_story_ok():
    r = session.delete(f"{API}/social/stories/{S['story_a_text']}",
                       headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200


# ---------- Reels ----------
def test_30_reel_create_ok():
    r = session.post(f"{API}/reels",
                     json={"media_url": S["video_a_url"], "caption": "TEST reel A",
                           "music": {"title": "Senja", "url": "/music/senja-tenang.wav"},
                           "privacy": "RT"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["liked_by_me"] is False
    assert j["like_count"] == 0
    S["reel_a"] = j["id"]


def test_31_reel_requires_own_media():
    r = session.post(f"{API}/reels",
                     json={"media_url": S["video_b_url"], "privacy": "RT"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 400


def test_32_reel_feed_cross_rt_excluded():
    rows = session.get(f"{API}/reels", headers=hdr(S["warga_b"]), timeout=20).json()
    assert S["reel_a"] not in [x["id"] for x in rows]


def test_33_reel_like_cross_rt_403():
    r = session.post(f"{API}/reels/{S['reel_a']}/like", headers=hdr(S["warga_b"]), timeout=20)
    assert r.status_code == 403


def test_34_reel_like_own_ok():
    r = session.post(f"{API}/reels/{S['reel_a']}/like", headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200
    assert r.json()["liked"] is True
    assert r.json()["like_count"] == 1


def test_35_reel_delete_others_403():
    r = session.delete(f"{API}/reels/{S['reel_a']}", headers=hdr(S["warga_b"]), timeout=20)
    assert r.status_code == 403


def test_36_reel_delete_own_ok():
    r = session.delete(f"{API}/reels/{S['reel_a']}", headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200


# ---------- UMKM nearby & featured ----------
def test_40_warga_a_create_merchant():
    r = session.post(f"{API}/marketplace/merchants",
                     json={"name": "TEST Toko A", "category": "Makanan",
                           "phone": "08129999", "phone_public": False, "description": "Warung TEST"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200, r.text
    S["merchant_a"] = r.json()["id"]


def test_41_umkm_nearby_resident():
    r = session.get(f"{API}/umkm/nearby", headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["has_region"] is True
    nearby_ids = [c["id"] for c in j["nearby"]]
    # merchant_a is in same village -> should appear
    assert S["merchant_a"] in nearby_ids or any(c["id"] == S["merchant_a"] for c in j["featured"])


def test_42_resident_no_umkm_feature_perm():
    r = session.post(f"{API}/umkm/featured",
                     json={"merchant_id": S["merchant_a"], "note": "TEST"},
                     headers=hdr(S["warga_a"]), timeout=20)
    assert r.status_code == 403


def test_43_marketplace_phone_hidden_non_owner():
    r = session.get(f"{API}/marketplace/merchants/{S['merchant_a']}",
                    headers=hdr(S["warga_b"]), timeout=20)
    assert r.status_code == 200
    assert r.json()["phone"] == ""


def test_44_marketplace_phone_visible_owner():
    r = session.get(f"{API}/marketplace/merchants/{S['merchant_a']}",
                    headers=hdr(S["warga_a"]), timeout=20)
    assert r.json()["phone"] == "08129999"


# ---------- Cleanup ----------
def test_99_cleanup():
    # Delete stories/reels created (reel already deleted). Delete merchant.
    try:
        session.delete(f"{API}/social/stories/{S.get('story_a_video','')}", headers=hdr(S["warga_a"]), timeout=10)
    except Exception:
        pass
    # merchant delete endpoint not public; leave DB with TEST prefix
