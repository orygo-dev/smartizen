# SMARTIZEN — Implementation Gap Analysis (Phase 0 → MVP)

Stack note: environment mandates FastAPI + React + MongoDB (approved by owner). The spec's NestJS+MySQL+Prisma+Redis cannot run/deploy here (no MySQL/Redis; supervisor runs uvicorn). All functional & architectural intent is preserved with a modular monolith.

## Module Classification
| Module | Status | Notes |
|---|---|---|
| Auth (JWT access/refresh, phone OTP, reset, sessions, brute-force) | COMPLETE | OTP simulated (dev_otp), SMS provider pluggable |
| Identity (User/Person/SocialProfile separation) | COMPLETE | NIK stored as nik_hash (HMAC) + obfuscated, never plaintext |
| Regions (Province→RT hierarchy, ancestors) | COMPLETE | Seeded sample tree; cascade API |
| RBAC + region-scoped authorization | COMPLETE | can_access_region server-side; cross-RT 403 verified |
| Role Assignment (status, scope, history) | COMPLETE | Used for RT_HEAD, RESIDENT; official replacement supported |
| Membership (PENDING/ACTIVE/ENDED, move RT) | COMPLETE | Never overwrites history |
| RT self-registration + wizard + verify | COMPLETE | Independent of Village; 8-step UI |
| Duplicate RT claim / conflict | COMPLETE | Super Admin resolve (keep/replace/evidence/reject) |
| Resident-before-RT (unclaimed RT) | COMPLETE | PENDING_RT_VERIFICATION + invite |
| Village-later linkage | PARTIAL | RT entity is canonical; linkage endpoint deferred |
| Civic: Announcements/Agenda/Complaints/Letters/Dues | COMPLETE | Letters workflow-driven + doc number + QR preview |
| Social: Feed/Follow/Warga discovery | COMPLETE | Warga-RT gated to verified residents |
| Dashboards (Citizen/RT/Region/Super Admin) | COMPLETE | Real-data KPIs, no fake numbers |
| Notifications (in-app) | COMPLETE | FCM pluggable |
| Audit log | COMPLETE | Sensitive actions recorded server-side |
| Story / Reels / Chat / Call / Live / Marketplace / SmartCoin / Gift / Creator / Ads | MISSING (out of MVP scope) | Branded "coming soon" states; abstractions to follow in later phases |

## Dangerous items checked
- No NIK/KK plaintext. No fake production data. Region authorization enforced server-side (frontend ids untrusted). No custom crypto (bcrypt/PyJWT/HMAC via audited libs).
