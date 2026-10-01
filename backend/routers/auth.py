from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from bson import ObjectId

from core.db import db
from core.common import new_id, audit
from core.rbac import user_roles, user_permissions, primary_role
from core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, generate_otp, iso, now_utc, get_current_user,
)
from datetime import timedelta
from fastapi import Depends

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterReq(BaseModel):
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    email: Optional[EmailStr] = None


class LoginReq(BaseModel):
    identifier: str  # phone or email
    password: str


class OtpReq(BaseModel):
    code: str


class ForgotReq(BaseModel):
    identifier: str


class ResetReq(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)


async def _build_user_payload(user_doc, uid):
    assignments = await db.role_assignments.find({"user_id": uid, "status": "ACTIVE"}).to_list(100)
    for a in assignments:
        a.pop("_id", None)
    profile = await db.social_profiles.find_one({"user_id": uid}, {"_id": 0})
    person = await db.persons.find_one({"user_id": uid}, {"_id": 0})
    tmp = {"role_assignments": assignments}
    return {
        "id": uid,
        "phone": user_doc.get("phone"),
        "email": user_doc.get("email"),
        "status": user_doc.get("status"),
        "phone_verified": bool(user_doc.get("phone_verified_at")),
        "full_name": (person or {}).get("full_name"),
        "profile": profile,
        "role_assignments": assignments,
        "roles": user_roles(tmp),
        "permissions": sorted(user_permissions(tmp)),
        "primary_role": primary_role(tmp),
    }


async def _issue_tokens(uid, request: Request):
    sid = new_id()
    await db.sessions.insert_one({
        "id": sid, "user_id": uid, "created_at": iso(),
        "user_agent": request.headers.get("user-agent", ""), "revoked": False,
    })
    return create_access_token(uid), create_refresh_token(uid, sid)


@router.post("/register")
async def register(req: RegisterReq, request: Request):
    phone = req.phone.strip()
    email = req.email.lower() if req.email else None
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar. Silakan masuk.")
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar.")
    user_doc_new = {
        "phone": phone, "password_hash": hash_password(req.password),
        "status": "ACTIVE", "phone_verified_at": None, "last_login_at": None, "created_at": iso(),
    }
    if email:
        user_doc_new["email"] = email
    res = await db.users.insert_one(user_doc_new)
    uid = str(res.inserted_id)
    await db.persons.insert_one({"id": new_id(), "user_id": uid, "full_name": req.full_name, "created_at": iso()})
    username = f"warga{phone[-4:]}{new_id()[:4]}"
    await db.social_profiles.insert_one({
        "id": new_id(), "user_id": uid, "username": username, "display_name": req.full_name,
        "bio": "", "avatar": None, "followers": 0, "following": 0, "created_at": iso(),
    })
    code = generate_otp()
    await db.otps.insert_one({
        "id": new_id(), "user_id": uid, "code": code, "purpose": "phone_verify",
        "expires_at": now_utc() + timedelta(minutes=10), "created_at": iso(),
    })
    access, refresh = await _issue_tokens(uid, request)
    await audit(uid, "user.register", "user", uid)
    user_doc = await db.users.find_one({"_id": ObjectId(uid)})
    return {
        "access_token": access, "refresh_token": refresh,
        "user": await _build_user_payload(user_doc, uid),
        "dev_otp": code,  # dev only: real build sends via SMS provider
    }


@router.post("/verify-otp")
async def verify_otp(req: OtpReq, current=Depends(get_current_user)):
    uid = current["id"]
    rec = await db.otps.find_one({"user_id": uid, "purpose": "phone_verify", "code": req.code})
    if not rec:
        raise HTTPException(status_code=400, detail="Kode OTP salah atau sudah kedaluwarsa.")
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"phone_verified_at": iso()}})
    await db.otps.delete_many({"user_id": uid, "purpose": "phone_verify"})
    return {"ok": True, "message": "Nomor HP berhasil diverifikasi."}


@router.post("/login")
async def login(req: LoginReq, request: Request):
    ident = req.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"phone": req.identifier.strip()}, {"email": ident}]})
    ip = request.client.host if request.client else "?"
    key = f"{ip}:{ident}"
    attempt = await db.login_attempts.find_one({"identifier": key})
    if attempt and attempt.get("count", 0) >= 5 and attempt.get("locked_until") and attempt["locked_until"] > iso():
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": key},
            {"$inc": {"count": 1}, "$set": {"locked_until": (now_utc() + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Nomor HP/email atau kata sandi salah.")
    if user.get("status") == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan. Hubungi dukungan.")
    await db.login_attempts.delete_many({"identifier": key})
    uid = str(user["_id"])
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": iso()}})
    access, refresh = await _issue_tokens(uid, request)
    return {"access_token": access, "refresh_token": refresh, "user": await _build_user_payload(user, uid)}


@router.post("/refresh")
async def refresh_token(request: Request):
    body = await request.json()
    token = body.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token tidak ada.")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token tidak valid.")
        sess = await db.sessions.find_one({"id": payload.get("sid")})
        if not sess or sess.get("revoked"):
            raise HTTPException(status_code=401, detail="Sesi tidak aktif.")
        return {"access_token": create_access_token(payload["sub"])}
    except Exception:
        raise HTTPException(status_code=401, detail="Sesi tidak valid.")


@router.get("/me")
async def me(current=Depends(get_current_user)):
    user_doc = await db.users.find_one({"_id": ObjectId(current["id"])})
    return await _build_user_payload(user_doc, current["id"])


@router.get("/sessions")
async def sessions(current=Depends(get_current_user)):
    rows = await db.sessions.find({"user_id": current["id"], "revoked": False}, {"_id": 0}).to_list(100)
    return rows


@router.post("/logout")
async def logout(request: Request, current=Depends(get_current_user)):
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    sid = body.get("session_id")
    if sid:
        await db.sessions.update_one({"id": sid, "user_id": current["id"]}, {"$set": {"revoked": True}})
    return {"ok": True}


@router.post("/logout-all")
async def logout_all(current=Depends(get_current_user)):
    await db.sessions.update_many({"user_id": current["id"]}, {"$set": {"revoked": True}})
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(req: ForgotReq):
    import secrets
    ident = req.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"phone": req.identifier.strip()}, {"email": ident}]})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "id": new_id(), "user_id": str(user["_id"]), "token": token,
            "expires_at": (now_utc() + timedelta(hours=1)).isoformat(), "used": False, "created_at": iso(),
        })
        print(f"[RESET] token for {ident}: {token}")
        return {"ok": True, "dev_token": token}
    return {"ok": True}  # do not leak existence


@router.post("/reset-password")
async def reset_password(req: ResetReq):
    rec = await db.password_reset_tokens.find_one({"token": req.token, "used": False})
    if not rec or rec["expires_at"] < iso():
        raise HTTPException(status_code=400, detail="Tautan reset tidak valid atau kedaluwarsa.")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])}, {"$set": {"password_hash": hash_password(req.password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True, "message": "Kata sandi berhasil diubah. Silakan masuk."}
