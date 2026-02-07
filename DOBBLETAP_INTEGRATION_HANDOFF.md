# DTTracker ↔ Dobbletap Integration - Complete Handoff

**For**: Dobbletap Development Team
**From**: DTTracker Team
**Date**: February 7, 2026
**Status**: ✅ PRODUCTION READY

---

## 🎉 Integration Status

**Outbound (DTTracker → Dobbletap)**: ✅ **WORKING**
- Campaigns created in DTTracker successfully sync to Dobbletap
- Tested with zero-budget test activation

**Inbound (Dobbletap → DTTracker)**: ✅ **READY**
- All webhook endpoints deployed and tested
- Ready to receive creator submissions, status updates, etc.

---

## 📊 Integration Overview

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

## 🚀 Part 1: Creator Sync (Dobbletap → DTTracker)

### Why This Matters

**Brands on DTTracker need to see Dobbletap creators** to send them campaign requests. Without this sync:
- ❌ Creators exist only in Dobbletap
- ❌ Brands can't discover them in DTTracker
- ❌ No campaign requests can be sent

**With creator sync**:
- ✅ Dobbletap creators appear in DTTracker's creator list
- ✅ Brands can browse and invite them to campaigns
- ✅ Unified creator network across both platforms

---

### Implementation: Creator Sync Webhook

**Endpoint**: Already deployed at DTTracker
**URL**: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap`
**Method**: `POST`
**Authentication**: Bearer token (SYNC_API_KEY)

#### When to Send

Send creator data to DTTracker when:
1. ✅ A new creator signs up on Dobbletap
2. ✅ A creator updates their profile (handle, stats, platforms)
3. ✅ A creator's verification status changes
4. ✅ Initial bulk sync (send all existing creators)

#### Payload Format

```json
{
  "eventType": "creator_sync",
  "timestamp": "2026-02-07T18:30:00Z",
  "creators": [
    {
      "id": "creator-uuid-from-dobbletap",
      "handle": "@chioma.creates",
      "platform": "tiktok",
      "followerCount": 125000,
      "verificationStatus": "verified",
      "engagementRate": 4.5,
      "categories": ["beauty", "lifestyle"],
      "profileUrl": "https://tiktok.com/@chioma.creates",
      "email": "chioma@example.com",
      "phone": "08012345678",
      "location": "Lagos, Nigeria",
      "bio": "Content creator | Beauty & Lifestyle",
      "isActive": true,
      "lastActiveAt": "2026-02-07T18:00:00Z"
    }
  ]
}
```

#### Field Mapping

| Dobbletap Field | DTTracker Field | Required | Notes |
|-----------------|-----------------|----------|-------|
| `id` | `dobble_tap_creator_id` | ✅ Yes | Unique identifier |
| `handle` | `handle` | ✅ Yes | e.g., @username |
| `platform` | `platform` | ✅ Yes | tiktok, instagram, youtube |
| `followerCount` | `follower_count` | ✅ Yes | Numeric |
| `engagementRate` | `engagement_rate` | No | Percentage (e.g., 4.5) |
| `verificationStatus` | `verification_status` | No | verified, pending, unverified |
| `categories` | `categories` | No | Array of strings |
| `profileUrl` | `profile_url` | No | Link to creator's profile |
| `email` | `email` | No | Contact email |
| `phone` | `phone` | No | Contact phone |
| `location` | `location` | No | City, Country |

#### Example Request

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "creator_sync",
    "timestamp": "2026-02-07T18:30:00Z",
    "creators": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "handle": "@chioma.creates",
        "platform": "tiktok",
        "followerCount": 125000,
        "verificationStatus": "verified",
        "engagementRate": 4.5,
        "categories": ["beauty", "lifestyle"],
        "profileUrl": "https://tiktok.com/@chioma.creates",
        "email": "chioma@example.com",
        "isActive": true
      }
    ]
  }'
```

#### Expected Response

**Success (200 OK)**:
```json
{
  "success": true,
  "synced": 1,
  "created": 1,
  "updated": 0,
  "creators": [
    {
      "id": "dttracker-creator-uuid",
      "dobble_tap_creator_id": "550e8400-e29b-41d4-a716-446655440000",
      "handle": "@chioma.creates",
      "status": "created"
    }
  ]
}
```

**Error (400/500)**:
```json
{
  "error": "Missing required field: handle",
  "field": "handle"
}
```

---

### Sync Strategy Recommendations

#### Option 1: Initial Bulk Sync (Recommended)

When integration first goes live, send ALL existing Dobbletap creators to DTTracker:

```javascript
// Pseudocode
const creators = await getAllCreatorsFromDobbletap();
const batchSize = 100; // Send in batches

for (let i = 0; i < creators.length; i += batchSize) {
  const batch = creators.slice(i, i + batchSize);
  await sendToDTTracker({
    eventType: "creator_sync",
    timestamp: new Date().toISOString(),
    creators: batch
  });
}
```

#### Option 2: Real-Time Sync (Ongoing)

After initial sync, send updates in real-time:

```javascript
// When creator signs up
await sendToDTTracker({
  eventType: "creator_sync",
  creators: [newCreator]
});

// When creator updates profile
await sendToDTTracker({
  eventType: "creator_sync",
  creators: [updatedCreator]
});
```

#### Option 3: Scheduled Sync (Fallback)

Daily sync to catch any missed updates:

```javascript
// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const creatorsUpdatedToday = await getUpdatedCreators(last24Hours);
  if (creatorsUpdatedToday.length > 0) {
    await sendToDTTracker({
      eventType: "creator_sync",
      creators: creatorsUpdatedToday
    });
  }
});
```

---

### Testing Creator Sync

```bash
# Test syncing a single creator
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "creator_sync",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "creators": [
      {
        "id": "'$(uuidgen | tr '[:upper:]' '[:lower:]')'",
        "handle": "@test.creator",
        "platform": "tiktok",
        "followerCount": 50000,
        "isActive": true
      }
    ]
  }'
```

Then verify in DTTracker database:

```sql
-- Check if creator was synced
SELECT id, handle, platform, follower_count, dobble_tap_creator_id
FROM creators
WHERE dobble_tap_creator_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Part 2: Content Submission Flow

When creators on Dobbletap submit content (upload videos, post URLs), DTTracker needs to receive this data so brands can review submissions.

### Use Case

1. Brand creates campaign in DTTracker → Syncs to Dobbletap
2. Creator sees campaign on Dobbletap → Submits content link
3. **Dobbletap sends webhook to DTTracker** → Submission appears in brand's dashboard
4. Brand reviews and approves → Pays creator

---

### 6 Webhook Endpoints (Dobbletap → DTTracker)

All endpoints use the same authentication:
- **Method**: `POST`
- **Base URL**: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1`
- **Auth Header**: `Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655`
- **Content-Type**: `application/json`

---

### 1. Submission Created/Updated

**Endpoint**: `/dobbletap-webhook-submission`

**When to send**: Creator uploads content or submits asset for a campaign

**Payload**:
```json
{
  "eventType": "submission_created",
  "timestamp": "2026-02-07T19:00:00Z",
  "data": {
    "creatorCampaignId": "activation-uuid-from-dttracker",
    "assetId": "submission-uuid-from-dobbletap",
    "assetUrl": "https://storage.dobbletap.com/uploads/video123.mp4",
    "version": 1,
    "submittedBy": "creator-uuid-from-dobbletap",
    "submittedAt": "2026-02-07T19:00:00Z",
    "note": "Here's my submission for the campaign!"
  }
}
```

**Response**:
```json
{
  "id": "dttracker-submission-uuid",
  "status": "received",
  "event_id": "webhook-event-uuid"
}
```

**Example**:
```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "submission_created",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "creatorCampaignId": "YOUR_ACTIVATION_ID",
      "assetId": "'$(uuidgen | tr '[:upper:]' '[:lower:]')'",
      "assetUrl": "https://storage.dobbletap.com/test-video.mp4",
      "version": 1,
      "submittedBy": "creator-uuid",
      "submittedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

---

### 2. Post URL Submitted

**Endpoint**: `/dobbletap-webhook-post-submitted`

**When to send**: Creator shares the public post URL (TikTok/Instagram/YouTube link)

**Payload**:
```json
{
  "eventType": "post_submitted",
  "timestamp": "2026-02-07T20:00:00Z",
  "data": {
    "creatorCampaignId": "activation-uuid-from-dttracker",
    "postUrl": "https://tiktok.com/@chioma.creates/video/7123456789",
    "platform": "tiktok",
    "submittedAt": "2026-02-07T20:00:00Z"
  }
}
```

**Example**:
```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-post-submitted" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "post_submitted",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "creatorCampaignId": "YOUR_ACTIVATION_ID",
      "postUrl": "https://tiktok.com/@test/video/123456",
      "platform": "tiktok",
      "submittedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

---

### 3. Status Change

**Endpoint**: `/dobbletap-webhook-status-change`

**When to send**: Campaign status changes (accepted, declined, etc.)

**Payload**:
```json
{
  "eventType": "status_changed",
  "timestamp": "2026-02-07T21:00:00Z",
  "data": {
    "creatorCampaignId": "activation-uuid-from-dttracker",
    "oldStatus": "pending",
    "newStatus": "accepted",
    "changedBy": "creator-uuid"
  }
}
```

---

### 4. Review Decision

**Endpoint**: `/dobbletap-webhook-review-decision`

**When to send**: Brand approves/rejects content on Dobbletap

**Payload**:
```json
{
  "eventType": "review_decision",
  "timestamp": "2026-02-07T22:00:00Z",
  "data": {
    "assetId": "submission-uuid-from-dobbletap",
    "decision": "approved",
    "feedback": "Great work! Approved.",
    "reviewerType": "brand",
    "reviewedBy": "brand-user-uuid"
  }
}
```

---

### 5. Campaign Completed

**Endpoint**: `/dobbletap-webhook-campaign-completed`

**When to send**: Campaign finishes and payment processed

**Payload**:
```json
{
  "eventType": "campaign_completed",
  "timestamp": "2026-02-08T10:00:00Z",
  "data": {
    "creatorCampaignId": "activation-uuid-from-dttracker",
    "status": "completed",
    "paymentAmount": 50000,
    "paymentCurrency": "NGN",
    "paymentReference": "PYSK_ABC123",
    "completedAt": "2026-02-08T10:00:00Z"
  }
}
```

---

### 6. Verification Completed

**Endpoint**: `/dobbletap-webhook-verification-completed`

**When to send**: SM panel task or contest entry verified

**Payload**:
```json
{
  "eventType": "verification_completed",
  "timestamp": "2026-02-08T11:00:00Z",
  "data": {
    "submissionId": "submission-uuid-from-dobbletap",
    "verificationType": "sm_panel",
    "verificationStatus": "verified",
    "verificationResults": {
      "likes": 1250,
      "shares": 89,
      "comments": 145
    },
    "verifiedAt": "2026-02-08T11:00:00Z"
  }
}
```

---

## 🔐 Authentication

All webhook requests must include:

```
Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655
```

**Security Notes**:
- ✅ Store this API key securely (environment variable)
- ✅ Never commit to source control
- ✅ Use HTTPS only
- ✅ Implement retry logic with exponential backoff
- ✅ Log all webhook attempts for debugging

---

## ⚡ Idempotency

DTTracker implements idempotency to prevent duplicate processing:

**Idempotency Key Format**: `{campaignId}-{eventType}-{timestamp}`

**What this means**:
- ✅ Safe to retry failed requests
- ✅ Duplicate events automatically detected
- ✅ Returns 200 with "already_processed" status

**Example**:
```json
// First request - creates submission
POST /dobbletap-webhook-submission
{
  "eventType": "submission_created",
  "timestamp": "2026-02-07T19:00:00Z",
  ...
}
Response: 200 OK { "status": "received" }

// Retry same request - detects duplicate
POST /dobbletap-webhook-submission
{
  "eventType": "submission_created",
  "timestamp": "2026-02-07T19:00:00Z", // Same timestamp!
  ...
}
Response: 200 OK { "status": "already_processed" }
```

---

## 🧪 Testing

### Automated Test Suite

DTTracker provides a complete test suite:

```bash
# Run all integration tests
./test-e2e-integration.sh
```

**What it tests**:
- ✅ Campaign creation (DTTracker → Dobbletap)
- ✅ All 6 webhook endpoints
- ✅ Error handling (404s for missing data)
- ✅ Idempotency detection

**Expected result**: 9/9 tests passing ✅

### Manual Testing

Test individual webhooks:

```bash
# Get a real activation ID first
ACTIVATION_ID="paste-real-activation-id-here"

# Test submission webhook
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"submission_created\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"creatorCampaignId\": \"$ACTIVATION_ID\",
      \"assetId\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"assetUrl\": \"https://storage.dobbletap.com/test.mp4\",
      \"version\": 1,
      \"submittedBy\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"submittedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }
  }"
```

---

## 📊 Verification Queries

After sending webhooks, verify data in DTTracker:

### Check Creator Sync

```sql
-- View synced creators from Dobbletap
SELECT
  id,
  handle,
  platform,
  follower_count,
  dobble_tap_creator_id,
  created_at
FROM creators
WHERE dobble_tap_creator_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Check Submissions

```sql
-- View submissions from Dobbletap
SELECT
  id,
  activation_id,
  creator_id,
  asset_url,
  post_url,
  status,
  submitted_at,
  dobble_tap_submission_id
FROM activation_submissions
WHERE dobble_tap_submission_id IS NOT NULL
ORDER BY submitted_at DESC
LIMIT 10;
```

### Check Webhook Events

```sql
-- View all webhook events received
SELECT
  id,
  event_type,
  campaign_id,
  timestamp,
  processed_at,
  payload->>'title' as title
FROM webhook_events
ORDER BY timestamp DESC
LIMIT 20;
```

---

## ❌ Error Handling

### Expected Error Responses

**404 Not Found**:
```json
{
  "error": "Activation not found",
  "event_id": "webhook-event-uuid",
  "status": "activation_not_found"
}
```

**Meaning**: The activation/campaign doesn't exist in DTTracker yet.
**Action**: Verify the `creatorCampaignId` matches an activation created in DTTracker.

**401 Unauthorized**:
```json
{
  "error": "Unauthorized"
}
```

**Meaning**: Invalid or missing API key.
**Action**: Check the Authorization header contains the correct Bearer token.

**500 Internal Server Error**:
```json
{
  "error": "Database connection failed"
}
```

**Meaning**: Something went wrong on DTTracker's side.
**Action**: Retry with exponential backoff, then contact DTTracker team if persists.

### Retry Strategy

```javascript
async function sendWebhookWithRetry(url, payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }

      // Don't retry 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error: ${response.status}`);
      }

      // Retry on 5xx or 429
      if (i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
        continue;
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

---

## 📋 Integration Checklist

### Phase 1: Creator Sync

- [ ] Implement creator sync webhook sender
- [ ] Test with single creator
- [ ] Perform initial bulk sync of all existing creators
- [ ] Verify creators appear in DTTracker
- [ ] Set up real-time sync on creator updates
- [ ] Schedule daily sync as backup

### Phase 2: Content Submissions

- [ ] Implement submission webhook when creator uploads content
- [ ] Implement post URL webhook when creator shares public link
- [ ] Test end-to-end: DTTracker campaign → Dobbletap → Creator submits → Back to DTTracker
- [ ] Verify submissions appear in brand dashboard

### Phase 3: Status & Lifecycle

- [ ] Implement status change webhooks
- [ ] Implement review decision webhooks
- [ ] Implement campaign completion webhooks
- [ ] Implement verification webhooks (if applicable)

### Phase 4: Production

- [ ] Run full E2E test suite
- [ ] Monitor webhook success rates
- [ ] Set up alerts for failed webhooks
- [ ] Document any custom fields/extensions
- [ ] Train support team on integration

---

## 🔗 Quick Reference

| Purpose | Endpoint | Use Case |
|---------|----------|----------|
| **Sync Creators** | `/creator-sync-from-dobbletap` | Show Dobbletap creators in DTTracker |
| **Content Upload** | `/dobbletap-webhook-submission` | Creator uploads video/asset |
| **Post URL** | `/dobbletap-webhook-post-submitted` | Creator shares TikTok/IG link |
| **Status Update** | `/dobbletap-webhook-status-change` | Campaign accepted/declined |
| **Review** | `/dobbletap-webhook-review-decision` | Brand approves/rejects |
| **Completion** | `/dobbletap-webhook-campaign-completed` | Campaign finishes + payment |
| **Verification** | `/dobbletap-webhook-verification-completed` | SM panel task verified |

**Base URL**: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1`
**API Key**: `617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655`
**Test Script**: `./test-e2e-integration.sh`

---

## 📞 Support & Contact

**DTTracker Team**
- Dashboard: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
- Function Logs: Check each endpoint for real-time logs
- Issues: Report integration issues with webhook event IDs for faster debugging

**Integration Status**: ✅ LIVE
**Last Updated**: February 7, 2026
**Version**: 1.0

---

## 🚦 Next Steps for Dobbletap Team

1. **PRIORITY 1 - Creator Sync**: Implement creator sync webhook so DTTracker can see your creators
   - Start with test creator
   - Then bulk sync all existing creators
   - Set up real-time updates

2. **PRIORITY 2 - Content Submissions**: When creators submit content, send webhooks to DTTracker
   - Test with the activation that just synced successfully
   - Verify submissions appear in DTTracker dashboard

3. **PRIORITY 3 - Full Lifecycle**: Implement remaining webhooks for complete workflow

**Questions?** Test everything and share results. We're here to help! 🚀
