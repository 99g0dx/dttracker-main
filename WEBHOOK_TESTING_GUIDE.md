# Complete Webhook Testing Guide

This guide covers end-to-end testing of the DTTracker ↔ Dobbletap integration.

## Architecture Overview

```
┌─────────────────────┐                    ┌─────────────────────┐
│    DTTracker        │                    │    Dobbletap        │
│  (ucbueapoexnxhttynfzy) │                    │ (qetwrowpllnkucyxoojp) │
└─────────────────────┘                    └─────────────────────┘
         │                                            │
         │ 1. Campaign Created                        │
         │────────────────────────────────────────────▶│
         │                                            │
         │ 2. Creator Assigned (by Dobbletap)         │
         │◀────────────────────────────────────────────│
         │                                            │
         │ 3. Submission Created                      │
         │◀────────────────────────────────────────────│
         │                                            │
         │ 4. Review Decision                         │
         │────────────────────────────────────────────▶│
         │                                            │
         │ 5. Post Submitted                          │
         │◀────────────────────────────────────────────│
         │                                            │
         │ 6. Campaign Completed                      │
         │◀────────────────────────────────────────────│
```

---

## Direction 1: DTTracker → Dobbletap (Outbound)

**What**: DTTracker sends campaign/approval data TO Dobbletap
**Who implements**: Dobbletap team needs to create these endpoints
**Test script**: `./test-outbound-webhooks.sh`

### Endpoints Dobbletap Should Implement

1. **POST /api/webhooks/dttracker/campaign-created**
   - Receives new campaign data from DTTracker
   - Creates campaign in Dobbletap system

2. **POST /api/webhooks/dttracker/campaign-updated**
   - Receives campaign updates
   - Updates existing campaign data

3. **POST /api/webhooks/dttracker/creator-invitation**
   - Notifies when DTTracker invites a creator
   - Tracks invitations

4. **POST /api/webhooks/dttracker/content-approved**
   - Notifies when content is approved in DTTracker
   - Triggers next steps in Dobbletap

### Test Outbound Webhooks

```bash
# Run the test script
./test-outbound-webhooks.sh
```

**Expected Response** (once Dobbletap implements):
```json
{
  "id": "dobbletap-record-id",
  "status": "received"
}
```

---

## Direction 2: Dobbletap → DTTracker (Inbound) ✅ IMPLEMENTED

**What**: Dobbletap sends submission/status data TO DTTracker
**Who implements**: DTTracker team (YOU) - **ALREADY DONE!**
**Test script**: `./test-webhooks.sh`

### Implemented Endpoints (All Active ✅)

1. **POST /dobbletap-webhook-submission**
   - Receives content uploads from Dobbletap
   - Stores submission data

2. **POST /dobbletap-webhook-status-change**
   - Receives campaign status updates
   - Tracks acceptance/decline/completion

3. **POST /dobbletap-webhook-review-decision**
   - Receives approval/rejection decisions
   - Updates submission status

4. **POST /dobbletap-webhook-post-submitted**
   - Receives public post URLs
   - Links to published content

5. **POST /dobbletap-webhook-campaign-completed**
   - Receives payment confirmation
   - Marks campaigns complete

6. **POST /dobbletap-webhook-verification-completed**
   - Receives verification results
   - Updates submission verification status

### Test Inbound Webhooks

```bash
# Run the test script
./test-webhooks.sh
```

**Response Examples**:

**First time** (new webhook):
```json
{
  "id": "submission-uuid",
  "status": "received",
  "event_id": "webhook-event-uuid"
}
```

**Duplicate** (idempotency working):
```json
{
  "id": "webhook-event-uuid",
  "status": "already_processed",
  "processed_at": "2026-02-07T15:43:41Z"
}
```

---

## End-to-End Test Flow

### Step 1: Create Campaign in DTTracker

**Action**: Create a campaign in DTTracker dashboard
**What happens**: DTTracker sends `campaign_created` webhook to Dobbletap

**Test manually**:
```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/api/webhooks/dttracker/campaign-created" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "campaign_created",
    "data": {
      "id": "test-campaign-123",
      "title": "Test Campaign",
      "budget": 100000
    }
  }'
```

---

### Step 2: Creator Accepts Offer (in Dobbletap)

**Action**: Creator accepts campaign in Dobbletap system
**What happens**: Dobbletap sends `status_changed` webhook to DTTracker ✅

**Test**:
```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-status-change" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "status_changed",
    "timestamp": "2026-02-07T16:00:00Z",
    "data": {
      "creatorCampaignId": "test-campaign-123",
      "oldStatus": "pending",
      "newStatus": "accepted",
      "changedBy": "creator-uuid"
    }
  }'
```

---

### Step 3: Creator Submits Content (in Dobbletap)

**Action**: Creator uploads video in Dobbletap
**What happens**: Dobbletap sends `submission_created` webhook to DTTracker ✅

**Test**:
```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "submission_created",
    "timestamp": "2026-02-07T16:30:00Z",
    "data": {
      "creatorCampaignId": "test-campaign-123",
      "assetId": "test-asset-456",
      "assetUrl": "https://storage.example.com/video.mp4",
      "version": 1,
      "submittedBy": "creator-uuid",
      "submittedAt": "2026-02-07T16:30:00Z"
    }
  }'
```

---

### Step 4: Brand Approves Content (in DTTracker)

**Action**: Brand reviews and approves in DTTracker dashboard
**What happens**: DTTracker sends `content_approved` to Dobbletap

**Test**:
```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/api/webhooks/dttracker/content-approved" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "content_approved",
    "data": {
      "submissionId": "test-asset-456",
      "approvedBy": "brand-user-uuid",
      "feedback": "Looks great!"
    }
  }'
```

---

### Step 5: Creator Posts Content (in Dobbletap)

**Action**: Creator shares public post URL in Dobbletap
**What happens**: Dobbletap sends `post_submitted` webhook to DTTracker ✅

**Test**:
```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-post-submitted" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "post_submitted",
    "timestamp": "2026-02-07T17:00:00Z",
    "data": {
      "creatorCampaignId": "test-campaign-123",
      "postUrl": "https://tiktok.com/@creator/video/123",
      "platform": "tiktok",
      "submittedAt": "2026-02-07T17:00:00Z"
    }
  }'
```

---

### Step 6: Payment Processed (in Dobbletap)

**Action**: Dobbletap processes payment via Paystack
**What happens**: Dobbletap sends `campaign_completed` webhook to DTTracker ✅

**Test**:
```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-campaign-completed" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "campaign_completed",
    "timestamp": "2026-02-07T18:00:00Z",
    "data": {
      "creatorCampaignId": "test-campaign-123",
      "status": "completed",
      "paymentAmount": 50000,
      "paymentCurrency": "NGN",
      "paymentReference": "PYSK_123456",
      "completedAt": "2026-02-07T18:00:00Z"
    }
  }'
```

---

## Verification

### Check Webhook Logs in Database

```sql
-- See all received webhooks
SELECT
  event_type,
  campaign_id,
  timestamp,
  processed_at
FROM webhook_events
ORDER BY processed_at DESC
LIMIT 10;

-- See all submissions
SELECT
  id,
  activation_id,
  dobble_tap_submission_id,
  status,
  submitted_at
FROM activation_submissions
ORDER BY created_at DESC
LIMIT 10;

-- See verification results
SELECT
  id,
  verification_type,
  status,
  verified_at
FROM verification_results
ORDER BY created_at DESC
LIMIT 10;
```

---

## Authentication

Both systems use the same `SYNC_API_KEY` for authentication:

**Current Key**: `617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655`

**DTTracker** (receiving webhooks):
- Set in Supabase secrets: ✅ DONE
- Used to verify incoming requests from Dobbletap

**Dobbletap** (sending webhooks):
- Must include in `Authorization: Bearer <key>` header
- When sending webhooks to DTTracker endpoints

---

## Troubleshooting

### 401 Unauthorized
**Problem**: SYNC_API_KEY mismatch
**Solution**: Ensure both systems use the same key

### 404 Not Found
**Problem**: Endpoint doesn't exist
**Solution**: Check if function is deployed

### Foreign Key Constraint Error
**Problem**: Referenced entities don't exist
**Solution**: Ensure activation/creator exists before submission

### Idempotency "already_processed"
**Problem**: Same webhook sent twice
**Solution**: This is CORRECT behavior! Change timestamp for new test

---

## Next Steps

1. ✅ **DTTracker webhooks** - All 6 endpoints deployed and working
2. ⏳ **Dobbletap webhooks** - Dobbletap team needs to implement endpoints
3. 🤝 **Coordinate testing** - Test full flow with both teams
4. 🚀 **Production deployment** - Enable in production environment

---

## Support

**DTTracker Webhook Endpoints**:
- Base URL: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1`
- Status: ✅ All deployed and active
- Test Script: `./test-webhooks.sh`

**Dobbletap Webhook Endpoints**:
- Base URL: `https://qetwrowpllnkucyxoojp.supabase.co/functions/v1`
- Status: ⏳ Pending implementation
- Test Script: `./test-outbound-webhooks.sh`

**Questions?** Check function logs in Supabase dashboard or test with curl commands above.
