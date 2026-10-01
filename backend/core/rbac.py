"""Role-Based Access Control + region-scoped authorization."""
from fastapi import HTTPException
from core.db import db

# ---------- roles ----------
ROLES = [
    "SUPER_ADMIN",
    "REGENCY_ADMIN", "REGENCY_OPERATOR", "REGENCY_ANALYST", "REGENCY_VIEWER",
    "DISTRICT_ADMIN", "DISTRICT_OPERATOR", "DISTRICT_VIEWER",
    "VILLAGE_ADMIN", "VILLAGE_OPERATOR", "VILLAGE_VERIFIER",
    "RW_HEAD", "RW_OPERATOR",
    "RT_HEAD", "RT_SECRETARY", "RT_TREASURER", "RT_OPERATOR",
    "RESIDENT", "HOUSEHOLD_HEAD", "HOUSEHOLD_MEMBER",
    "MERCHANT", "CREATOR",
    "MODERATOR", "SUPPORT", "AUDITOR",
]

# scope_type expected per role family
ROLE_SCOPE = {
    "SUPER_ADMIN": "PLATFORM",
    "REGENCY_ADMIN": "REGENCY", "REGENCY_OPERATOR": "REGENCY", "REGENCY_ANALYST": "REGENCY", "REGENCY_VIEWER": "REGENCY",
    "DISTRICT_ADMIN": "DISTRICT", "DISTRICT_OPERATOR": "DISTRICT", "DISTRICT_VIEWER": "DISTRICT",
    "VILLAGE_ADMIN": "VILLAGE", "VILLAGE_OPERATOR": "VILLAGE", "VILLAGE_VERIFIER": "VILLAGE",
    "RW_HEAD": "RW", "RW_OPERATOR": "RW",
    "RT_HEAD": "RT", "RT_SECRETARY": "RT", "RT_TREASURER": "RT", "RT_OPERATOR": "RT",
    "RESIDENT": "RT", "HOUSEHOLD_HEAD": "RT", "HOUSEHOLD_MEMBER": "RT",
    "MERCHANT": "PLATFORM", "CREATOR": "PLATFORM",
    "MODERATOR": "PLATFORM", "SUPPORT": "PLATFORM", "AUDITOR": "PLATFORM",
}

# granular permissions
P = {
    "region.manage", "user.manage", "rt_application.review", "rt_application.submit",
    "resident.read", "resident.verify", "resident.manage",
    "household.manage",
    "announcement.manage", "agenda.manage", "complaint.manage", "complaint.create",
    "letter.manage", "letter.request", "letter.approve",
    "dues.manage", "dues.pay",
    "feed.post", "feed.moderate",
    "dashboard.rt", "dashboard.rw", "dashboard.village", "dashboard.district",
    "dashboard.regency", "dashboard.admin", "dashboard.citizen",
    "audit.read", "umkm.feature",
}

ROLE_PERMISSIONS = {
    "SUPER_ADMIN": set(P),
    "REGENCY_ADMIN": {"dashboard.regency", "resident.read", "complaint.manage", "letter.manage", "audit.read", "announcement.manage"},
    "REGENCY_OPERATOR": {"dashboard.regency", "complaint.manage", "letter.manage"},
    "REGENCY_ANALYST": {"dashboard.regency"},
    "REGENCY_VIEWER": {"dashboard.regency"},
    "DISTRICT_ADMIN": {"dashboard.district", "resident.read", "complaint.manage", "letter.manage", "announcement.manage"},
    "DISTRICT_OPERATOR": {"dashboard.district", "complaint.manage"},
    "DISTRICT_VIEWER": {"dashboard.district"},
    "VILLAGE_ADMIN": {"dashboard.village", "resident.read", "resident.verify", "complaint.manage", "letter.manage", "letter.approve", "announcement.manage", "agenda.manage", "dues.manage"},
    "VILLAGE_OPERATOR": {"dashboard.village", "complaint.manage", "letter.manage"},
    "VILLAGE_VERIFIER": {"dashboard.village", "resident.read", "resident.verify"},
    "RW_HEAD": {"dashboard.rw", "resident.read", "complaint.manage", "announcement.manage", "agenda.manage"},
    "RW_OPERATOR": {"dashboard.rw", "complaint.manage"},
    "RT_HEAD": {"dashboard.rt", "resident.read", "resident.verify", "resident.manage", "household.manage", "announcement.manage", "agenda.manage", "complaint.manage", "letter.manage", "letter.approve", "dues.manage", "feed.post", "umkm.feature"},
    "RT_SECRETARY": {"dashboard.rt", "resident.read", "resident.verify", "household.manage", "announcement.manage", "agenda.manage", "letter.manage", "letter.approve", "umkm.feature"},
    "RT_TREASURER": {"dashboard.rt", "resident.read", "dues.manage"},
    "RT_OPERATOR": {"dashboard.rt", "resident.read", "announcement.manage", "umkm.feature"},
    "RESIDENT": {"dashboard.citizen", "complaint.create", "letter.request", "dues.pay", "feed.post"},
    "HOUSEHOLD_HEAD": {"dashboard.citizen", "complaint.create", "letter.request", "dues.pay", "feed.post", "household.manage"},
    "HOUSEHOLD_MEMBER": {"dashboard.citizen", "complaint.create", "letter.request", "dues.pay", "feed.post"},
    "MERCHANT": {"dashboard.citizen", "feed.post"},
    "CREATOR": {"dashboard.citizen", "feed.post"},
    "MODERATOR": {"feed.moderate", "complaint.manage"},
    "SUPPORT": {"dashboard.admin"},
    "AUDITOR": {"audit.read"},
}

# order of precedence for primary role (admin interfaces win over citizen)
ROLE_RANK = {r: i for i, r in enumerate([
    "SUPER_ADMIN", "REGENCY_ADMIN", "DISTRICT_ADMIN", "VILLAGE_ADMIN", "VILLAGE_VERIFIER",
    "RW_HEAD", "RT_HEAD", "RT_SECRETARY", "RT_TREASURER", "RT_OPERATOR",
    "MODERATOR", "SUPPORT", "AUDITOR", "MERCHANT", "CREATOR",
    "HOUSEHOLD_HEAD", "RESIDENT", "HOUSEHOLD_MEMBER",
])}


def user_roles(user: dict):
    return [a["role"] for a in user.get("role_assignments", [])]


def user_permissions(user: dict) -> set:
    perms = set()
    for role in user_roles(user):
        perms |= ROLE_PERMISSIONS.get(role, set())
    return perms


def primary_role(user: dict) -> str:
    roles = user_roles(user)
    if not roles:
        return "RESIDENT"
    return sorted(roles, key=lambda r: ROLE_RANK.get(r, 999))[0]


def has_permission(user: dict, perm: str) -> bool:
    return perm in user_permissions(user)


def require_permission(user: dict, perm: str):
    if not has_permission(user, perm):
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses untuk tindakan ini.")


def scope_ids(user: dict):
    """Region ids this user has an active admin assignment on (excluding PLATFORM)."""
    out = []
    for a in user.get("role_assignments", []):
        if a.get("scope_type") != "PLATFORM" and a.get("scope_id"):
            out.append(a["scope_id"])
    return out


def is_platform_admin(user: dict) -> bool:
    return any(a.get("scope_type") == "PLATFORM" and a.get("role") in ("SUPER_ADMIN", "SUPPORT", "AUDITOR", "MODERATOR")
               for a in user.get("role_assignments", []))


async def can_access_region(user: dict, region_id: str) -> bool:
    """Server-side region authorization. Frontend-sent ids are never trusted."""
    if is_platform_admin(user):
        return True
    region = await db.regions.find_one({"id": region_id})
    if not region:
        return False
    allowed = set(scope_ids(user))
    if region_id in allowed:
        return True
    if allowed & set(region.get("ancestors", [])):
        return True
    return False


async def descendant_rt_ids(user: dict):
    """All RT region ids within the user's admin scope. SUPER_ADMIN -> all."""
    if is_platform_admin(user):
        rts = await db.regions.find({"level": "RT"}, {"id": 1}).to_list(100000)
        return [r["id"] for r in rts]
    scopes = scope_ids(user)
    if not scopes:
        return []
    rts = await db.regions.find(
        {"level": "RT", "$or": [{"id": {"$in": scopes}}, {"ancestors": {"$in": scopes}}]},
        {"id": 1},
    ).to_list(100000)
    return [r["id"] for r in rts]
