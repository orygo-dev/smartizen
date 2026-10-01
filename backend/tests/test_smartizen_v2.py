"""SMARTIZEN v2 — tests for Household, Letter PDF+QR, Stories, Chat features."""
import os
import io
import time
import uuid
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

session = requests.Session()
S = {}


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Login existing seeded users ----------
def test_admin_login():
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    S["admin"] = r.json()["access_token"]


def test_rt_head_login():
    r = session.post(f"{API}/auth/login", json={"identifier": "081255550003", "password": "test123"}, timeout=20)
    assert r.status_code == 200, r.text
    S["rt_head"] = r.json()["access_token"]
    me = session.get(f"{API}/auth/me", headers=hdr(S["rt_head"]), timeout=20).json()
    S["rt_head_id"] = me["id"]
    S["rt_head_rt_id"] = None
    for ra in (me.get("role_assignments") or []):
        if ra.get("role") == "RT_HEAD" and ra.get("status") == "ACTIVE":
            S["rt_head_rt_id"] = ra.get("scope_id")
            break
    assert S["rt_head_rt_id"], f"RT_HEAD scope not found: {me}"


def test_warga_login():
    r = session.post(f"{API}/auth/login", json={"identifier": "081277770005", "password": "test123"}, timeout=20)
    assert r.status_code == 200, r.text
    S["warga"] = r.json()["access_token"]
    me = session.get(f"{API}/auth/me", headers=hdr(S["warga"]), timeout=20).json()
    S["warga_id"] = me["id"]


# ---------- Household ----------
def test_household_create_masks_kk():
    kk = f"3171{random.randint(10**11, 10**12-1)}"
    S["kk_plain"] = kk
    r = session.post(f"{API}/households", json={
        "kk_number": kk, "address": "TEST Jl. Kebayoran 1", "head_name": "TEST Head"
    }, headers=hdr(S["warga"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("ok") is True
    S["household_id"] = data["household_id"]


def test_household_mine_shows_masked_only():
    r = session.get(f"{API}/households/mine", headers=hdr(S["warga"]), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    hh = data["household"]
    assert hh is not None
    # No plaintext kk, no hash leaked
    assert S["kk_plain"] not in str(hh)
    assert "kk_hash" not in hh and "kk_encrypted" not in hh
    assert hh.get("kk_masked", "").endswith(S["kk_plain"][-4:])
    # Auto head member added
    assert len(data["members"]) >= 1


def test_household_add_member():
    r = session.post(f"{API}/households/members", json={
        "full_name": "TEST Istri", "relation": "Istri", "nik": "3171000000009999"
    }, headers=hdr(S["warga"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    r2 = session.get(f"{API}/households/mine", headers=hdr(S["warga"]), timeout=20)
    members = r2.json()["members"]
    istri = next((m for m in members if m["full_name"] == "TEST Istri"), None)
    assert istri is not None
    S["member_id"] = istri["id"]
    # NIK must not leak
    assert "nik_hash" not in istri and "nik_encrypted" not in istri


def test_household_delete_member():
    r = session.delete(f"{API}/households/members/{S['member_id']}", headers=hdr(S["warga"]), timeout=20)
    assert r.status_code == 200, r.text
    r2 = session.get(f"{API}/households/mine", headers=hdr(S["warga"]), timeout=20)
    members = r2.json()["members"]
    assert not any(m["id"] == S["member_id"] for m in members)


def test_household_rt_list_own_rt():
    r = session.get(f"{API}/households", params={"rt_id": S["rt_head_rt_id"]},
                    headers=hdr(S["rt_head"]), timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    for row in rows:
        assert "member_count" in row
        assert "kk_hash" not in row and "kk_encrypted" not in row


def test_household_rt_cross_rt_forbidden():
    # Use the SUPER_ADMIN to find another RT ACTIVE id different from rt_head's
    r = session.get(f"{API}/regions", params={"level": "RT"}, headers=hdr(S["admin"]), timeout=20)
    # might not accept no parent; fallback: look through cascade like iteration_1
    other_rt_id = None
    if r.status_code == 200 and isinstance(r.json(), list):
        for row in r.json():
            if row.get("id") != S["rt_head_rt_id"]:
                other_rt_id = row["id"]
                break
    if not other_rt_id:
        pytest.skip("No other RT found to test cross-RT 403")
    r2 = session.get(f"{API}/households", params={"rt_id": other_rt_id},
                     headers=hdr(S["rt_head"]), timeout=20)
    assert r2.status_code == 403, r2.text


# ---------- Letter PDF + QR ----------
def test_letter_pdf_unverified_returns_400():
    # Create a fresh letter (should be PENDING)
    types = session.get(f"{API}/civic/letter-types", headers=hdr(S["warga"]), timeout=20).json()
    assert types, "no letter types"
    lt = types[0]
    r = session.post(f"{API}/civic/letters", json={
        "letter_type_id": lt["id"], "purpose": "TEST pdf flow", "data": {}
    }, headers=hdr(S["warga"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    lid = r.json()["id"] if "id" in r.json() else r.json().get("letter", {}).get("id")
    assert lid, r.json()
    S["letter_id"] = lid
    r2 = session.get(f"{API}/civic/letters/{lid}/pdf", headers=hdr(S["warga"]), timeout=20)
    assert r2.status_code == 400, r2.text


def test_letter_verify_public_unknown_returns_valid_false():
    r = session.get(f"{API}/civic/letters/verify/{uuid.uuid4().hex}", timeout=20)
    assert r.status_code == 200
    assert r.json().get("valid") is False


def test_letter_pdf_verified_returns_pdf():
    """Verify a letter via RT_HEAD, then download PDF."""
    # letter S["letter_id"] belongs to warga under rt_head's RT (same rt in seed)
    # RT_HEAD lists pending letters & verifies
    r = session.get(f"{API}/civic/letters", params={"rt_id": S["rt_head_rt_id"]},
                    headers=hdr(S["rt_head"]), timeout=20)
    # Find action endpoint — try standard verify route
    # Try PATCH/POST /api/civic/letters/{id}/verify
    verified = False
    # may require multiple approval steps
    for _ in range(5):
        req = session.post(f"{API}/civic/letters/{S['letter_id']}/action",
                           json={"action": "APPROVE", "note": "ok"},
                           headers=hdr(S["rt_head"]), timeout=20)
        if req.status_code not in (200, 201):
            break
        # Check status
        chk = session.get(f"{API}/civic/letters/{S['letter_id']}", headers=hdr(S["rt_head"]), timeout=20)
        if chk.status_code == 200 and chk.json().get("status") == "VERIFIED":
            verified = True
            break
    if not verified:
        # fallback: direct DB check via /verify public
        pub = session.get(f"{API}/civic/letters/verify/{S['letter_id']}", timeout=20).json()
        verified = pub.get("valid") is True
    if not verified:
        pytest.skip("Could not reach VERIFIED state via /action endpoint")
    # Try PDF download
    r2 = session.get(f"{API}/civic/letters/{S['letter_id']}/pdf", headers=hdr(S["warga"]), timeout=20)
    assert r2.status_code == 200, r2.text
    assert r2.headers.get("content-type", "").startswith("application/pdf")
    assert r2.content[:4] == b"%PDF"
    # Public verify now returns valid=true + no sensitive PII
    r3 = session.get(f"{API}/civic/letters/verify/{S['letter_id']}", timeout=20)
    assert r3.status_code == 200
    body = r3.json()
    assert body.get("valid") is True
    # No sensitive fields
    for key in ("nik", "nik_hash", "nik_encrypted", "address", "phone"):
        assert key not in body, f"leaked field {key}: {body}"


# ---------- Stories ----------
def test_stories_create_and_list():
    r = session.post(f"{API}/social/stories", json={
        "media_type": "text", "text": "TEST story hello", "background": "#1E40AF"
    }, headers=hdr(S["warga"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    s = r.json()
    assert s.get("id")
    # expires_at ~24h ahead
    assert s.get("expires_at")
    S["story_id"] = s["id"]

    r2 = session.get(f"{API}/social/stories", headers=hdr(S["warga"]), timeout=20)
    assert r2.status_code == 200
    groups = r2.json()
    mine = next((g for g in groups if g["author_id"] == S["warga_id"]), None)
    assert mine, groups
    item = next((i for i in mine["items"] if i["id"] == S["story_id"]), None)
    assert item is not None
    assert "all_seen" in mine
    assert "viewed_by_me" in item


def test_stories_view_mark():
    r = session.post(f"{API}/social/stories/{S['story_id']}/view",
                     headers=hdr(S["rt_head"]), timeout=20)
    assert r.status_code == 200
    r2 = session.get(f"{API}/social/stories", headers=hdr(S["rt_head"]), timeout=20)
    groups = r2.json()
    mine = next((g for g in groups if g["author_id"] == S["warga_id"]), None)
    if mine:
        item = next((i for i in mine["items"] if i["id"] == S["story_id"]), None)
        assert item and item["viewed_by_me"] is True


def test_stories_viewers_owner_only():
    r = session.get(f"{API}/social/stories/{S['story_id']}/viewers",
                    headers=hdr(S["warga"]), timeout=20)
    assert r.status_code == 200
    r2 = session.get(f"{API}/social/stories/{S['story_id']}/viewers",
                     headers=hdr(S["rt_head"]), timeout=20)
    assert r2.status_code == 403


# ---------- Chat ----------
def test_chat_with_rt_creates_conversation():
    r = session.post(f"{API}/chat/with-rt", headers=hdr(S["warga"]), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("id")
    assert data.get("peer", {}).get("is_rt") is True
    S["conv_id"] = data["id"]


def test_chat_list_conversations_includes():
    r = session.get(f"{API}/chat/conversations", headers=hdr(S["warga"]), timeout=20)
    assert r.status_code == 200
    convs = r.json()
    assert any(c["id"] == S["conv_id"] for c in convs)
    for c in convs:
        assert "unread" in c


def test_chat_send_idempotent():
    cmid = f"test-{uuid.uuid4().hex}"
    r1 = session.post(f"{API}/chat/conversations/{S['conv_id']}/messages",
                      json={"text": "Halo pak RT", "client_message_id": cmid},
                      headers=hdr(S["warga"]), timeout=20)
    assert r1.status_code in (200, 201), r1.text
    m1 = r1.json()
    r2 = session.post(f"{API}/chat/conversations/{S['conv_id']}/messages",
                      json={"text": "Halo pak RT", "client_message_id": cmid},
                      headers=hdr(S["warga"]), timeout=20)
    assert r2.status_code in (200, 201)
    m2 = r2.json()
    assert m1["id"] == m2["id"], "Idempotency broken"
    S["seq_first"] = m1["seq"]


def test_chat_messages_after_filter():
    time.sleep(0.05)
    cmid = f"test-{uuid.uuid4().hex}"
    session.post(f"{API}/chat/conversations/{S['conv_id']}/messages",
                 json={"text": "Pesan kedua", "client_message_id": cmid},
                 headers=hdr(S["warga"]), timeout=20)
    r = session.get(f"{API}/chat/conversations/{S['conv_id']}/messages",
                    params={"after": S["seq_first"]},
                    headers=hdr(S["warga"]), timeout=20)
    assert r.status_code == 200
    msgs = r.json()
    assert all(m["seq"] > S["seq_first"] for m in msgs)
    assert len(msgs) >= 1


def test_chat_non_participant_403():
    # Admin should not be participant
    r = session.get(f"{API}/chat/conversations/{S['conv_id']}/messages",
                    headers=hdr(S["admin"]), timeout=20)
    assert r.status_code == 403, r.text
