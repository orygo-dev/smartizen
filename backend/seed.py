"""Seed Indonesian region hierarchy, admin, letter types, and demo content."""
import os
from core.db import db
from core.common import new_id
from core.security import hash_password, verify_password, iso, encrypt_sensitive, decrypt_sensitive


async def _region(level, name, code, parent=None, extra=None):
    ancestors = []
    parent_id = None
    if parent:
        parent_id = parent["id"]
        ancestors = parent.get("ancestors", []) + [parent["id"]]
    existing = await db.regions.find_one({"level": level, "name": name, "parent_id": parent_id})
    if existing:
        return existing
    doc = {
        "id": new_id(),
        "level": level,
        "name": name,
        "code": code,
        "parent_id": parent_id,
        "ancestors": ancestors,
        "status": (extra or {}).get("status", "ACTIVE"),
        "created_at": iso(),
    }
    doc.update(extra or {})
    await db.regions.insert_one(doc)
    return doc


async def seed_regions():
    if await db.regions.count_documents({}) > 0:
        return
    prov = await _region("PROVINCE", "DKI Jakarta", "31")
    kota = await _region("REGENCY", "Kota Jakarta Selatan", "3171", prov)
    kec = await _region("DISTRICT", "Kebayoran Baru", "317106", kota)
    for vname, vcode in [("Gandaria Utara", "3171061001"), ("Kramat Pela", "3171061002")]:
        kel = await _region("VILLAGE", vname, vcode, kec)
        for rwn in ["001", "002"]:
            rw = await _region("RW", f"RW {rwn}", f"{vcode}-{rwn}", kel, {"rw_number": rwn})
            for rtn in ["001", "005"]:
                status = "ACTIVE" if (vname == "Gandaria Utara" and rwn == "002" and rtn == "005") else "UNCLAIMED"
                await _region("RT", f"RT {rtn}", f"{vcode}-{rwn}-{rtn}", rw,
                              {"rt_number": rtn, "rw_number": rwn, "status": status})


async def seed_letter_types():
    if await db.letter_types.count_documents({}) > 0:
        return
    types = [
        {"name": "Surat Pengantar RT", "code": "SP_RT", "workflow": ["RT"],
         "fields": [{"key": "keperluan", "label": "Keperluan", "type": "text"}]},
        {"name": "Surat Keterangan Domisili", "code": "SK_DOMISILI", "workflow": ["RT", "VILLAGE"],
         "fields": [{"key": "keperluan", "label": "Keperluan", "type": "text"},
                    {"key": "alamat", "label": "Alamat Domisili", "type": "text"}]},
        {"name": "Surat Keterangan Tidak Mampu", "code": "SKTM", "workflow": ["RT", "VILLAGE"],
         "fields": [{"key": "keperluan", "label": "Keperluan", "type": "text"}]},
        {"name": "Surat Pengantar Nikah", "code": "SP_NIKAH", "workflow": ["RT", "VILLAGE"],
         "fields": [{"key": "pasangan", "label": "Nama Pasangan", "type": "text"}]},
    ]
    for t in types:
        t["id"] = new_id()
        t["created_at"] = iso()
        await db.letter_types.insert_one(t)


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    phone = os.environ.get("ADMIN_PHONE", "081200000000")
    user = await db.users.find_one({"email": email})
    if user is None:
        res = await db.users.insert_one({
            "phone": phone,
            "email": email,
            "password_hash": hash_password(password),
            "status": "ACTIVE",
            "phone_verified_at": iso(),
            "last_login_at": None,
            "created_at": iso(),
        })
        uid = str(res.inserted_id)
        await db.persons.insert_one({"id": new_id(), "user_id": uid, "full_name": "Super Admin Rakatin", "created_at": iso()})
        await db.social_profiles.insert_one({
            "id": new_id(), "user_id": uid, "username": "rakatin_admin",
            "display_name": "Super Admin", "bio": "Administrator Platform Rakatin",
            "avatar": None, "followers": 0, "following": 0, "created_at": iso(),
        })
    else:
        uid = str(user["_id"])
        if not verify_password(password, user.get("password_hash", "")):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(password)}})
    # ensure SUPER_ADMIN role
    existing_role = await db.role_assignments.find_one({"user_id": uid, "role": "SUPER_ADMIN"})
    if not existing_role:
        await db.role_assignments.insert_one({
            "id": new_id(), "user_id": uid, "role": "SUPER_ADMIN",
            "scope_type": "PLATFORM", "scope_id": None, "status": "ACTIVE",
            "start_date": iso(), "end_date": None, "assigned_by": "system", "created_at": iso(),
        })


async def seed_indexes():
    # drop stale non-partial email index if present
    try:
        existing = await db.users.index_information()
        if "email_1" in existing and not existing["email_1"].get("partialFilterExpression"):
            await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index(
        "email", unique=True,
        partialFilterExpression={"email": {"$type": "string"}},
    )
    await db.users.create_index("phone", unique=True)
    await db.regions.create_index([("level", 1), ("parent_id", 1)])
    await db.regions.create_index("ancestors")
    await db.role_assignments.create_index([("user_id", 1), ("status", 1)])
    await db.memberships.create_index([("rt_id", 1), ("status", 1)])
    await db.memberships.create_index("person_id")
    await db.feed_posts.create_index([("created_at", -1)])
    await db.otps.create_index("expires_at", expireAfterSeconds=0)
    await db.stories.create_index([("expires_at", 1), ("rt_id", 1)])
    await db.reels.create_index([("created_at", -1)])
    await db.media.create_index("id", unique=True)
    await db.umkm_featured.create_index([("rt_id", 1), ("week_start", 1)], unique=True)
    await db.merchants.create_index("ancestors")


async def migrate_sensitive():
    """Re-encrypt legacy reversible-hex NIK/KK values with Fernet."""
    legacy = {"$exists": True, "$type": "string", "$not": {"$regex": "^gAAAA"}}
    for coll, field in [(db.persons, "nik_encrypted"), (db.household_members, "nik_encrypted"), (db.households, "kk_encrypted")]:
        async for d in coll.find({field: legacy}, {"_id": 1, field: 1}):
            try:
                await coll.update_one({"_id": d["_id"]}, {"$set": {field: encrypt_sensitive(decrypt_sensitive(d[field]))}})
            except ValueError:
                pass


async def run_seed():
    await seed_indexes()
    await seed_regions()
    await seed_letter_types()
    await seed_admin()
    await migrate_sensitive()
