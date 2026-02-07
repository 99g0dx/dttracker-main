# DTTracker ↔ Dobbletap Integration - Complete Handoff

**For**: Dobbletap Development Team  
**From**: DTTracker Team  
**Date**: February 7, 2026  
**Status**: PRODUCTION READY  

**API key**: The sync API key is shared out-of-band. In all examples below, use the value provided by the DTTracker team (do not commit it to source control). This doc uses the placeholder `YOUR_SYNC_API_KEY` in examples.

---

## Integration Status

**Outbound (DTTracker → Dobbletap)**: WORKING  
- Campaigns created in DTTracker successfully sync to Dobbletap  
- Tested with zero-budget test activation  

**Inbound (Dobbletap → DTTracker)**: READY  
- All webhook endpoints deployed and tested  
- Ready to receive creator submissions, status updates, etc.  

---

## Integration Overview

```
┌──────────────┐                                    ┌──────────────┐
│              │  1. Campaign Created               │              │
│              │ ─────────────────────────────────> │              │
│              │                                    │              │
│  DTTracker   │  2. Creator Submissions            │  Dobbletap   │
│  (Brands)    │ <───────────────────────────────── │  (Creators)  │
│              │                                    │              │
│              │  3. Status Updates & Events        │              │
│              │ <───────────────────────────────── │              │
└──────────────┘                                    └──────────────┘
```

---

## Part 1: Creator Sync (Dobbletap → DTTracker)

### Why This Matters

**Brands on DTTracker need to see Dobbletap creators** to send them campaign requests. With creator sync, Dobbletap creators appear in DTTracker's creator list and brands can browse and invite them to campaigns.

### Implementation: Creator Sync Webhook

**Endpoint**: Deployed at DTTracker  
**URL**: `https://<SUPABASE_PROJECT>.supabase.co/functions/v1/creator-sync-from-dobbletap`  
**Method**: `POST`  
**Authentication**: Bearer token (SYNC_API_KEY)  

See **Implementation notes (current DTTracker)** at the end of this document for the **exact payload shape** and field names accepted by the deployed endpoint.

---

## Part 2: Content Submission Flow

When creators on Dobbletap submit content, DTTracker receives this data so brands can review submissions.

### Use Case

1. Brand creates campaign in DTTracker → Syncs to Dobbletap  
2. Creator sees campaign on Dobbletap → Submits content link  
3. Dobbletap sends webhook to DTTracker → Submission appears in brand's dashboard  
4. Brand reviews and approves → Pays creator  

See **Implementation notes (current DTTracker)** at the end for the **deployed submission webhook** URL and payload.

---

## Authentication

All webhook requests must include:

```
Authorization: Bearer YOUR_SYNC_API_KEY
```

**Security notes**: Store the API key in an environment variable; never commit to source control; use HTTPS only; implement retry logic with exponential backoff.

---

## Quick Reference

| Purpose | Endpoint | Use Case |
|---------|----------|----------|
| Sync Creators | `/creator-sync-from-dobbletap` | Show Dobbletap creators in DTTracker |
| Content Upload / Post URL | `/activation-submission-webhook` | Creator uploads or submits link (see Implementation notes) |
| Status / Review / Completion / Verification | (see Implementation notes) | Target design; see current deployment |

**Base URL**: `https://<SUPABASE_PROJECT>.supabase.co/functions/v1`  
**Test Script**: See repo `scripts/test-dobble-tap-integration.sh` if present.

---

## Support & Contact

**DTTracker Team**  
- Dashboard: Supabase project → Functions  
- Issues: Report integration issues with webhook event IDs for faster debugging  

**Integration Status**: LIVE  
**Last Updated**: February 7, 2026  
**Version**: 1.0  

---

## Implementation notes (current DTTracker)

The sections above describe the **target** integration design. The **currently deployed** DTTracker implementation differs in payload shape and number of endpoints as follows. Dobbletap should integrate against these current contracts.

### Creator sync (deployed)

- **Path**: `POST /creator-sync-from-dobbletap` (same as above).  
- **Auth**: `Authorization: Bearer <SYNC_API_KEY>`.  
- **Payload (actual)**  
  - Top-level: `creator_id` (required) – Dobbletap creator identifier (string; stored as `dobble_tap_user_id` in DTTracker).  
  - `social_accounts` (required) – Array of at least one object: `{ "platform": "tiktok" | "instagram" | "youtube", "handle": "@username" }`. Optional per account: `followers`.  
  - Optional: `profile_photo`, `bio`, `location`.  
- **DB**: DTTracker stores the Dobbletap id in `creators.dobble_tap_user_id` (TEXT), not `dobble_tap_creator_id`.  
- **Example**:

```json
{
  "creator_id": "550e8400-e29b-41d4-a716-446655440000",
  "social_accounts": [
    { "platform": "tiktok", "handle": "@chioma.creates", "followers": 125000 }
  ],
  "profile_photo": "https://...",
  "bio": "Content creator",
  "location": "Lagos, Nigeria"
}
```

### Submission webhook (deployed)

- **Path**: `POST /activation-submission-webhook` (single endpoint; no separate routes for “post submitted”, “status change”, “review”, “completion”, or “verification”).  
- **Auth**: Same Bearer token.  
- **Payload (actual)** – Flat JSON (no `eventType` / `data` wrapper):  
  - `activation_id` (required) – DTTracker activation UUID (same as “creator campaign” / activation in handoff).  
  - `creator_id` (optional if creator_handle + creator_platform provided) – DTTracker creator UUID.  
  - `creator_handle`, `creator_platform` (optional if creator_id provided) – e.g. `@handle`, `tiktok`.  
  - `content_url` – URL of uploaded asset or content.  
  - `proof_url` – URL of proof (e.g. post link).  
  - `proof_comment_text` – Optional comment.  
  - `submitted_at` – ISO timestamp.  
  - Optional: `payment_amount`, `tier`, `creator_followers`, `verification_method`.  
- **Example**:

```json
{
  "activation_id": "uuid-from-dttracker",
  "creator_id": "uuid-from-dttracker-or-null",
  "creator_handle": "@chioma.creates",
  "creator_platform": "tiktok",
  "content_url": "https://storage.dobbletap.com/uploads/video123.mp4",
  "proof_url": "https://tiktok.com/@chioma.creates/video/7123456789",
  "proof_comment_text": "Here's my submission!",
  "submitted_at": "2026-02-07T19:00:00Z"
}
```

- The “6 webhooks” (submission, post submitted, status change, review decision, campaign completed, verification completed) in the target design are **not** implemented as separate endpoints today. Only the single **activation-submission-webhook** above is deployed. Status/review/completion/verification flows would require new Edge Functions or routing if added later.

### Base URL and auth

- Base URL: Your Supabase project URL, e.g. `https://<project-ref>.supabase.co/functions/v1`.  
- Auth: Same as handoff (Bearer token only); only payload and route names differ as above.
