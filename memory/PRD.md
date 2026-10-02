# SMARTIZEN (Rakatin) — PRD

## Original problem statement
Smartizen — Import + Phase 7/8 Build (Web + Mobile-web super-app). Import orygo-dev/smartizen (FastAPI + React + MongoDB), stabilize; full UI testing of chat + marketplace; Phase 7+8 content: Story upgrades (video stories, background music, privacy controls, "Tampilkan Semua"), Reels basic (vertical video upload + feed playback) on real object storage; UMKM: "UMKM Sekitar" cards on resident home (region-scoped) + RT managers highlight a weekly featured UMKM; Production hardening: rotate/remove exposed Super Admin credential, audit RBAC region-scoping on new endpoints (cross-RT → 403), confirm NIK/KK hashing strategy. Integrations behind provider abstraction + flags (storage R2/S3, OTP, payments, FCM) mocked until keys. Future: WebSocket chat, chat media, full marketplace payments, SmartCoin.

## Architecture
FastAPI modular monolith (`backend/routers/*`, `backend/core/*`) + React CRA (Tailwind/shadcn) + MongoDB. New: `core/storage.py` (provider: emergent | s3 (AWS/R2) | mongo via STORAGE_PROVIDER), `core/content.py` (shared Story/Reel visibility RT/VILLAGE/FOLLOWERS), `routers/reels.py`, `routers/umkm.py`.

## User personas
Warga (mobile), Ketua/Pengurus RT (region-scoped dashboard), Super Admin.

## Core requirements (static)
Region-scoped RBAC enforced server-side; NIK/KK never plaintext; Bahasa Indonesia; light/dark; no fake production data.

## Implemented
### 2026-10-01
- Imported repo, services running; dependencies installed (reportlab, qrcode, boto3, cryptography).
- Super Admin password rotated (env-only); removed leaked password from tests/test_result.md; deleted legacy root test scripts + old test reports containing it. Seed re-hashes admin password from env on startup.
- NIK/KK: HMAC-SHA256 hash kept for lookup/dedupe; reversible "encryption" (was reversed-hex = plaintext-equivalent) replaced with Fernet (NIK_ENC_KEY); startup migration re-encrypts legacy values.
- Uploads → Emergent object storage (50MB video, Range/206 support), legacy base64 media still readable.
- Stories: photo/video upload, music library (3 generated tracks in /public/music) + own audio upload, privacy RT/VILLAGE/FOLLOWERS, delete own, "Tampilkan Semua" page /app/stories. View of invisible story → 403.
- Reels: upload composer, vertical snap feed with autoplay/mute, like, view count, delete own, same privacy.
- UMKM Sekitar on home (featured of resident's RT this week + newest in kelurahan); /dashboard/umkm for RT_HEAD/SECRETARY/OPERATOR + Super Admin to set/clear weekly featured (WIB Monday weeks), owner notified, audit logged; cross-RT → 403.
- Merchant phone hidden unless phone_public or owner.
- Tests: 31/31 new backend tests, test_smartizen.py 10/10; RT featured flow verified (tests/manual_umkm_rt_flow.py).

### 2026-10-02
- Reel comments (add/list/delete by author or reel owner, count, owner notified) via bottom sheet; share reel to RT feed (feed post with reel embed, hidden as "unavailable" if viewer lacks reel access).
- Full two-person E2E (seller+buyer): store → product → discover/save → Chat Penjual → bidirectional chat — passed. "Chat Penjual" now opens the conversation directly.
- Tests: backend/tests/test_reel_social_and_chat.py 28/28 (59/59 cumulative new-feature tests).

### 2026-10-02 (b)
- Feed Warga scoped server-side: residents see posts from their kelurahan (default) or only their RT (toggle), plus own posts; platform admins see all; out-of-area rt_id / like / comment → 403. Posts show RT label.
- Order requests: product dialog (from product grid or merchant detail) with qty + note → POST /api/marketplace/orders (server-priced); /app/pesanan with "Pesanan Saya"/"Pesanan Masuk"; seller accept/reject/complete, buyer cancel; notifications both ways; chat shortcut. No payment (settled directly).
- Tests: backend/tests/test_orders_and_feed_scope.py 34/34, regression 59/59.

### 2026-10-02 (c)
- Multi-item cart (per user, per browser, one shop, max 20 products): add from product dialog, floating cart bar, cart sheet with qty/remove/note → single multi-item order. "Pesan Sekarang" keeps direct single-item order.
- Seller badge: GET /api/marketplace/orders/pending-count; red badge on bottom-nav Marketplace tab (8s polling) + "Pesanan" button.
- Tests: test_cart_and_pending.py 15/15, regression 34/34.

## Backlog
- P0 (resolved 2026-10-02): Feed RT scoping.
- P0: Rewrite git history on GitHub to purge old password (owner action); set new secrets in production.
- P1: test_smartizen_v2.py depends on removed pre-seeded accounts → refactor to dynamic users; deeper UI E2E of chat & marketplace multi-user flows; per-media access control (media URLs are unguessable but public).
- P1: Real OTP (Twilio/ID gateway), payments (Midtrans/Xendit), FCM push — still MOCKED.
- P2: Reels transcoding/HLS, WebSocket chat, chat media, SmartCoin, creator monetization.

## Next tasks
Owner confirms git-history purge; real OTP provider; Reels comments/share.
