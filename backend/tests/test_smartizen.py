"""SMARTIZEN comprehensive backend tests."""
import os
import time
import random
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: try reading from frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"
ADMIN_ID = os.environ["ADMIN_EMAIL"]
ADMIN_PW = os.environ["ADMIN_PASSWORD"]

session = requests.Session()
state = {}


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- AUTH ----------
def test_admin_login():
    r = session.post(f"{API}/auth/login", json={"identifier": ADMIN_ID, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    state["admin_token"] = data["access_token"]


def test_admin_me_super_admin():
    r = session.get(f"{API}/auth/me", headers=auth_header(state["admin_token"]), timeout=20)
    assert r.status_code == 200, r.text
    me = r.json()
    assert me.get("primary_role") == "SUPER_ADMIN", me


def test_warga_register_and_verify_otp():
    phone = f"0812{random.randint(10000000, 99999999)}"
    r = session.post(f"{API}/auth/register", json={
        "phone": phone, "password": "Secret#2026", "full_name": "TEST Warga"
    }, timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert "access_token" in data
    assert "dev_otp" in data, data
    state["warga_token"] = data["access_token"]
    state["warga_phone"] = phone
    state["warga_otp"] = data["dev_otp"]

    r2 = session.post(f"{API}/auth/verify-otp",
                      json={"code": state["warga_otp"]},
                      headers=auth_header(state["warga_token"]), timeout=20)
    assert r2.status_code == 200, r2.text


# ---------- REGIONS ----------
def test_region_cascade():
    r = session.get(f"{API}/regions", params={"level": "PROVINCE"}, timeout=20)
    assert r.status_code == 200, r.text
    provs = r.json()
    dki = next((p for p in provs if "DKI Jakarta" in p.get("name", "")), None)
    assert dki, provs
    state["dki_id"] = dki["id"]

    r = session.get(f"{API}/regions", params={"level": "REGENCY", "parent_id": dki["id"]}, timeout=20)
    assert r.status_code == 200
    jaksel = next((x for x in r.json() if "Jakarta Selatan" in x["name"]), None)
    assert jaksel

    r = session.get(f"{API}/regions", params={"level": "DISTRICT", "parent_id": jaksel["id"]}, timeout=20)
    kebayoran = next((x for x in r.json() if "Kebayoran Baru" in x["name"]), None)
    assert kebayoran

    r = session.get(f"{API}/regions", params={"level": "VILLAGE", "parent_id": kebayoran["id"]}, timeout=20)
    gandaria = next((x for x in r.json() if "Gandaria Utara" in x["name"]), None)
    assert gandaria
    state["village_id"] = gandaria["id"]

    r = session.get(f"{API}/regions", params={"level": "RW", "parent_id": gandaria["id"]}, timeout=20)
    rw002 = next((x for x in r.json() if "002" in x["name"]), None)
    assert rw002
    state["rw_id"] = rw002["id"]

    r = session.get(f"{API}/regions", params={"level": "RT", "parent_id": rw002["id"]}, timeout=20)
    rts = r.json()
    rt005 = next((x for x in rts if "005" in x["name"]), None)
    assert rt005, rts
    assert rt005.get("status") == "ACTIVE", rt005
    state["rt005_id"] = rt005["id"]
    # find an UNCLAIMED RT
    unclaimed = next((x for x in rts if x.get("status") == "UNCLAIMED"), None)
    assert unclaimed, "No UNCLAIMED RT found"
    state["unclaimed_rt_id"] = unclaimed["id"]


# ---------- RT APPLICATION ----------
def test_rt_application_flow():
    # Register a new user for RT
    phone = f"0813{random.randint(10000000, 99999999)}"
    r = session.post(f"{API}/auth/register", json={
        "phone": phone, "password": "Secret#2026", "full_name": "TEST RT Head"
    }, timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    rt_token = data["access_token"]
    # verify OTP
    session.post(f"{API}/auth/verify-otp", json={"code": data["dev_otp"]}, headers=auth_header(rt_token), timeout=20)
    state["rthead_token"] = rt_token

    new_rt_number = f"{random.randint(20, 99):03d}"
    payload = {
        "rw_id": state["rw_id"],
        "rt_number": new_rt_number,
        "official": {"name": "TEST RT Head", "full_name": "TEST RT Head", "nik": "3171000000000001", "phone": phone},
        "documents": [{"type": "SK", "file_key": "test/sk.pdf"}]
    }
    r = session.post(f"{API}/rt/applications", json=payload, headers=auth_header(rt_token), timeout=20)
    assert r.status_code in (200, 201), r.text
    appdata = r.json()
    app = appdata.get("application", appdata)
    assert app.get("status") == "PENDING_REVIEW", appdata
    state["app_id"] = app["id"]

    # Admin lists
    r = session.get(f"{API}/rt/applications", params={"status": "PENDING_REVIEW"},
                    headers=auth_header(state["admin_token"]), timeout=20)
    assert r.status_code == 200, r.text
    assert any(a["id"] == state["app_id"] for a in r.json())

    # Verify
    r = session.post(f"{API}/rt/applications/{state['app_id']}/verify",
                     json={"decision": "APPROVE", "notes": "ok"},
                     headers=auth_header(state["admin_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text

    # Confirm role
    r = session.get(f"{API}/auth/me", headers=auth_header(rt_token), timeout=20)
    me = r.json()
    roles = me.get("roles") or []
    role_names = [x.get("role") if isinstance(x, dict) else x for x in roles]
    assert "RT_HEAD" in role_names or me.get("primary_role") == "RT_HEAD", me


# ---------- RESIDENT BEFORE RT ----------
def test_resident_membership_pending():
    r = session.post(f"{API}/residents/membership",
                     json={"rt_id": state["unclaimed_rt_id"]},
                     headers=auth_header(state["warga_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("rt_joined") is False, data
    membership = data.get("membership") or data
    status_val = membership.get("status") if isinstance(membership, dict) else None
    assert status_val == "PENDING_RT_VERIFICATION" or data.get("status") == "PENDING_RT_VERIFICATION", data


# ---------- REGION AUTHORIZATION ----------
def test_rbac_rt_head_cross_rt_forbidden():
    # RT_HEAD trying to view residents of RT005 (not their RT)
    r = session.get(f"{API}/residents", params={"rt_id": state["rt005_id"]},
                    headers=auth_header(state["rthead_token"]), timeout=20)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


def test_rbac_resident_cannot_list_applications():
    r = session.get(f"{API}/rt/applications",
                    headers=auth_header(state["warga_token"]), timeout=20)
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# ---------- CIVIC ----------
def test_civic_complaint_create_and_list_mine():
    r = session.post(f"{API}/civic/complaints",
                     json={"title": "TEST Lampu mati", "description": "Jalan gelap", "category": "INFRASTRUKTUR"},
                     headers=auth_header(state["warga_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    r2 = session.get(f"{API}/civic/complaints", params={"mine": "true"},
                     headers=auth_header(state["warga_token"]), timeout=20)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)


def test_civic_letter_types_and_create():
    r = session.get(f"{API}/civic/letter-types", headers=auth_header(state["warga_token"]), timeout=20)
    assert r.status_code == 200, r.text
    types = r.json()
    assert len(types) > 0, types
    lt = types[0]
    lt_id = lt.get("id")
    payload = {"letter_type_id": lt_id, "purpose": "Testing", "data": {}}
    r2 = session.post(f"{API}/civic/letters", json=payload,
                      headers=auth_header(state["warga_token"]), timeout=20)
    assert r2.status_code in (200, 201), r2.text


# ---------- SOCIAL ----------
def test_social_feed_crud():
    r = session.post(f"{API}/social/feed", json={"text": "TEST Halo warga!"},
                     headers=auth_header(state["warga_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    post = r.json()
    pid = post.get("id")
    assert pid

    r2 = session.get(f"{API}/social/feed", headers=auth_header(state["warga_token"]), timeout=20)
    assert r2.status_code == 200

    r3 = session.post(f"{API}/social/feed/{pid}/like",
                      headers=auth_header(state["warga_token"]), timeout=20)
    assert r3.status_code in (200, 201), r3.text
