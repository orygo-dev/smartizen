# SMARTIZEN — Next Implementation Plan

MVP delivered (Phases 1–5 + Social foundation). Recommended order for subsequent phases:

1. Household management (KK, family members) + resident claim/duplicate review (Phase 4 completion).
2. Letter PDF generation + real QR verification endpoint (Phase 5 completion).
3. Village-later linkage endpoint + RW/Village/District/Regency aggregate analytics depth (Phase 18).
4. Story (create/view, 24h expiry via scheduled task) + Story→Chat reply (Phase 7).
5. Chat engine (WebSocket + Mongo change streams for realtime; media via object storage) (Phase 9).
6. Marketplace/UMKM catalog (Phase 11).
7. Reels + media processing (requires object storage + worker) (Phase 8).
8. SmartCoin ledger + Gift (feature-flagged payments) (Phase 13), Creator & rewards (14–15).
9. Ads/monetization abstraction + analytics (Phase 16).
10. Live (Cloudflare Stream provider adapter) (Phase 12), Call (RealtimeKit adapter) (Phase 10).

External integrations to wire when keys provided: Cloudflare R2 (object storage), Cloudflare Stream, RealtimeKit, Firebase FCM, payment gateway (QRIS/VA). All behind provider adapters + feature flags.
