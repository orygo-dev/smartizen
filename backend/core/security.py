import os
import hmac
import hashlib
import random
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from cryptography.fernet import Fernet
from fastapi import Request, HTTPException, Depends

from core.db import db

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 12
REFRESH_TTL_DAYS = 30


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt=None):
    return (dt or now_utc()).isoformat()


# ---------- password ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------- NIK / KK ----------
# nik_hash: keyed HMAC-SHA256 for duplicate detection / exact-match lookup (gov verification).
# encrypt_sensitive: Fernet (AES-128-CBC + HMAC) with a separate key; only RT verifiers decrypt.
def nik_hash(value: str) -> str:
    key = os.environ["NIK_HMAC_KEY"].encode("utf-8")
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()


def _fernet() -> Fernet:
    return Fernet(os.environ["NIK_ENC_KEY"].encode("utf-8"))


def encrypt_sensitive(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_sensitive(token: str) -> str:
    if token.startswith("gAAAA"):
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    return bytes.fromhex(token).decode("utf-8")[::-1]  # legacy reversed-hex format (pre-migration)


# ---------- jwt ----------
def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access", "exp": now_utc() + timedelta(minutes=ACCESS_TTL_MIN)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, session_id: str) -> str:
    payload = {"sub": user_id, "sid": session_id, "type": "refresh", "exp": now_utc() + timedelta(days=REFRESH_TTL_DAYS)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])


# ---------- otp ----------
def generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


# ---------- current user ----------
async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sesi tidak ditemukan. Silakan masuk kembali.")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token tidak valid.")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan.")
        if user.get("status") == "SUSPENDED":
            raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan.")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        # attach active role assignments
        assignments = await db.role_assignments.find(
            {"user_id": user["id"], "status": "ACTIVE"}
        ).to_list(100)
        for a in assignments:
            a["id"] = str(a.pop("_id"))
        user["role_assignments"] = assignments
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir. Silakan masuk kembali.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid.")


CurrentUser = Depends(get_current_user)
