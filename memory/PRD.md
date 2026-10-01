# SMARTIZEN — PRD

## Original problem statement
Build SMARTIZEN ("Warga Terhubung, Lingkungan Maju"), an Indonesian digital citizen super-app combining civic services, RT/RW/Village/District/Regency digital administration with region-scoped RBAC, and social+community (Feed, Story, Reels, Follow, Chat), plus Marketplace/UMKM, Creator ecosystem, SmartCoin & Gift, advertising and analytics. Multi-region single platform; RT can register independently of Village.

## Stack (environment-adapted, owner-approved)
FastAPI + React (CRA/Tailwind/shadcn) + MongoDB (Motor). Modular monolith with clear module boundaries (auth, identity, regions, rt, residents, civic, social, dashboard). NestJS+MySQL+Prisma+Redis from the original spec are not runnable in this environment.

## User personas
Warga, Ketua/Pengurus RT, Ketua RW, Kelurahan/Desa, Kecamatan, Kabupaten/Kota, Merchant/UMKM, Creator, Moderator, Super Admin.

## Core requirements (static)
- Identity separation: User / Person / SocialProfile / Membership / Household / RoleAssignment.
- NIK/KK never plaintext (HMAC hash + obfuscation). No fake production data.
- Region hierarchy Province→Regency→District→Village→RW→RT→Resident; NOT a registration dependency.
- RBAC + granular permissions + region scope, enforced server-side (frontend ids untrusted).
- RT independent registration, resident-before-RT, duplicate claim conflict, official replacement, Village-later linkage.
- Bahasa Indonesia UI; humane empty/loading/error states; branded design (blue/cyan/teal/green).

## Implemented (2026-06, MVP)
- Auth: register (Warga + RT), phone OTP (simulated dev_otp), login (phone/email), refresh, sessions, logout/all, forgot/reset, brute-force lockout.
- Regions seed + cascade API; RT self-registration 8-step wizard; Super Admin verification; claim conflict resolution; invitation.
- Residents: membership create (incl. unclaimed RT), RT-side verify/approve/reject; move-RT preserves history.
- Civic: announcements, agenda, complaints (timeline), letters (workflow + doc number + QR preview), dues (QRIS simulation).
- Social: feed (categories, like, comment), follow, Warga-RT discovery (gated to verified residents), in-app notifications.
- Dashboards: Citizen app (bottom-nav) + role-aware admin dashboards (RT / region / Super Admin) with real-data KPIs.
- Audit logging on sensitive actions. Branded 404. Light/dark theme.
- Tests: 11/11 backend pytest pass (auth, RBAC cross-region 403, RT flow, resident-before-RT, civic, social). Frontend E2E verified by testing agent.

## Backlog (prioritized)
P0: Household/KK; Letter PDF + QR verification endpoint; Village-later linkage endpoint.
P1: Story (+24h expiry scheduler); Chat engine (WebSocket); Marketplace/UMKM catalog.
P2: Reels + media worker (object storage); SmartCoin/Gift (feature-flagged payments); Creator & rewards; Ads/monetization; Live/Call provider adapters.

## External integrations (pending keys)
Cloudflare R2, Cloudflare Stream, RealtimeKit, Firebase FCM, payment gateway — all behind provider adapters + feature flags.

## Next tasks
1. Household management module. 2. Letter PDF/QR verification. 3. Village linkage + deeper regional analytics.
