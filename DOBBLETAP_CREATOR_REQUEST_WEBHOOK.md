# Dobbletap: Creator Request Webhook Specification

## Overview

When a brand on DTTracker creates a **creator request** (requesting specific creators to join a campaign), DTTracker will send this webhook to Dobbletap so the creators can see and respond to the request.

**Status**: ⚠️ **NEEDS IMPLEMENTATION** on Dobbletap side

---

## Webhook Endpoint

```
POST https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker
```

**Authentication**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c
```

---

## Event Type

```json
{
  "eventType": "creator_request_created"
}
```

---

## Payload Structure

```json
{
  "eventType": "creator_request_created",
  "timestamp": "2026-02-08T10:30:00Z",
  "data": {
    "request_id": "83f34028-8118-4734-9149-eaa3253a81c5",
    "campaign_id": "6ef1f35c-96ee-43d6-b02e-c0fa26359d18",
    "campaign_type": "product_launch",
    "campaign_brief": "We're launching a new product and want you to promote it",
    "deliverables": ["tiktok_post", "instagram_reel"],
    "posts_per_creator": 3,
    "usage_rights": "all_above",
    "deadline": "2026-02-15",
    "urgency": "fast_turnaround",
    "contact_person_name": "Bukola Aduagba",
    "contact_person_email": "bukolafaduagba@gmail.com",
    "contact_person_phone": "08100029055",
    "creator_ids": [
      "29f99241-53d1-4f78-b9b0-2169f4a15a49",
      "4a7b5788-8117-4de6-8eaf-618725a0048d"
    ],
    "total_creators": 2
  }
}
```

---

## Field Descriptions

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `request_id` | UUID | DTTracker's creator request ID | ✅ Yes |
| `campaign_id` | UUID | Associated DTTracker campaign/activation ID | ❌ No |
| `campaign_type` | String | Type of campaign | ✅ Yes |
| `campaign_brief` | String | Campaign description | ✅ Yes |
| `deliverables` | Array | Content types requested | ✅ Yes |
| `posts_per_creator` | Number | Number of posts per creator | ✅ Yes |
| `usage_rights` | String | Usage rights for content | ✅ Yes |
| `deadline` | ISO Date | Campaign deadline | ✅ Yes |
| `urgency` | String | Urgency level | ✅ Yes |
| `contact_person_name` | String | Brand contact name | ✅ Yes |
| `contact_person_email` | String | Brand contact email | ✅ Yes |
| `contact_person_phone` | String | Brand contact phone | ❌ No |
| `creator_ids` | Array[UUID] | List of creator IDs requested | ✅ Yes |
| `total_creators` | Number | Total number of creators | ✅ Yes |

---

## Expected Behavior

When Dobbletap receives this webhook:

1. **Create Creator Request Records**
   - Store the request in Dobbletap's database
   - Associate with the specified creator IDs
   - Map DTTracker's `request_id` to Dobbletap's internal ID

2. **Show Requests to Creators**
   - Creators should see incoming requests in their dashboard
   - Display campaign details, deliverables, deadline
   - Show brand contact information
   - Allow creators to accept or decline

3. **Return Success Response**
   ```json
   {
     "success": true,
     "dobble_tap_request_id": "uuid-here"
   }
   ```

---

## Database Schema Suggestion

```sql
-- Creator requests table
CREATE TABLE creator_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dttracker_request_id UUID NOT NULL UNIQUE,
  campaign_id UUID REFERENCES campaigns(id),
  campaign_type TEXT NOT NULL,
  campaign_brief TEXT NOT NULL,
  deliverables JSONB NOT NULL,
  posts_per_creator INTEGER NOT NULL,
  usage_rights TEXT NOT NULL,
  deadline DATE NOT NULL,
  urgency TEXT NOT NULL,
  contact_person_name TEXT NOT NULL,
  contact_person_email TEXT NOT NULL,
  contact_person_phone TEXT,
  total_creators INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator request items (which creators are requested)
CREATE TABLE creator_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES creator_requests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL, -- References users(id)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, creator_id)
);

CREATE INDEX idx_creator_request_items_creator
  ON creator_request_items(creator_id, status);
```

---

## Implementation Example

```typescript
// In Dobbletap's /webhooks/dttracker handler

if (eventType === 'creator_request_created') {
  const {
    request_id,
    campaign_id,
    campaign_type,
    campaign_brief,
    deliverables,
    posts_per_creator,
    usage_rights,
    deadline,
    urgency,
    contact_person_name,
    contact_person_email,
    contact_person_phone,
    creator_ids,
    total_creators,
  } = data;

  // 1. Create the request
  const { data: creatorRequest, error: requestError } = await supabase
    .from('creator_requests')
    .insert({
      dttracker_request_id: request_id,
      campaign_id: campaign_id,
      campaign_type,
      campaign_brief,
      deliverables,
      posts_per_creator,
      usage_rights,
      deadline,
      urgency,
      contact_person_name,
      contact_person_email,
      contact_person_phone,
      total_creators,
    })
    .select()
    .single();

  if (requestError) {
    console.error('Failed to create creator request:', requestError);
    return res.status(500).json({
      error: requestError.message
    });
  }

  // 2. Create request items for each creator
  if (creator_ids && creator_ids.length > 0) {
    const items = creator_ids.map(creatorId => ({
      request_id: creatorRequest.id,
      creator_id: creatorId,
      status: 'pending',
    }));

    const { error: itemsError } = await supabase
      .from('creator_request_items')
      .insert(items);

    if (itemsError) {
      console.error('Failed to create request items:', itemsError);
      // Don't fail the whole request - just log
    }
  }

  // 3. Return success
  return res.json({
    success: true,
    dobble_tap_request_id: creatorRequest.id,
  });
}
```

---

## Testing

### Test Payload

```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c" \
  -d '{
    "eventType": "creator_request_created",
    "timestamp": "2026-02-08T10:30:00Z",
    "data": {
      "request_id": "83f34028-8118-4734-9149-eaa3253a81c5",
      "campaign_id": "6ef1f35c-96ee-43d6-b02e-c0fa26359d18",
      "campaign_type": "product_launch",
      "campaign_brief": "Test campaign brief",
      "deliverables": ["tiktok_post", "instagram_reel"],
      "posts_per_creator": 3,
      "usage_rights": "all_above",
      "deadline": "2026-02-15",
      "urgency": "fast_turnaround",
      "contact_person_name": "Test User",
      "contact_person_email": "test@example.com",
      "contact_person_phone": "1234567890",
      "creator_ids": ["29f99241-53d1-4f78-b9b0-2169f4a15a49"],
      "total_creators": 1
    }
  }'
```

### Expected Response

```json
{
  "success": true,
  "dobble_tap_request_id": "uuid-here"
}
```

---

## User Experience Flow

### 1. Brand Creates Request on DTTracker
- Selects creators from database
- Fills in campaign details
- Submits request

### 2. DTTracker Sends Webhook
- Creates request in DTTracker database
- Sends email to agency
- **Sends webhook to Dobbletap** ⭐ (NEW)

### 3. Dobbletap Receives Webhook
- Creates request in Dobbletap database
- Links to specified creators
- Returns success

### 4. Creators See Request
- Log into Dobbletap
- Go to "My Requests" or "Opportunities"
- See the request with:
  - Campaign details
  - Deliverables
  - Deadline
  - Brand contact
  - Accept/Decline buttons

### 5. Creator Responds
- Clicks "Accept" or "Decline"
- Request status updates in Dobbletap
- (Optional) Send webhook back to DTTracker with response

---

## Campaign Types

| Value | Label |
|-------|-------|
| `music_promotion` | Music Promotion |
| `brand_promotion` | Brand Promotion |
| `product_launch` | Product Launch |
| `event_activation` | Event/Activation |
| `other` | Other |

---

## Deliverables

| Value | Label |
|-------|-------|
| `tiktok_post` | TikTok Post |
| `instagram_reel` | Instagram Reel |
| `instagram_story` | Instagram Story |
| `youtube_short` | YouTube Short |
| `other` | Other |

---

## Usage Rights

| Value | Label |
|-------|-------|
| `creator_page_only` | Only on creator's page |
| `repost_brand_pages` | Repost on brand pages |
| `run_ads` | Run ads |
| `all_above` | All of the above |

---

## Urgency Levels

| Value | Label |
|-------|-------|
| `normal` | Normal |
| `fast_turnaround` | Fast Turnaround |
| `asap` | ASAP |

---

## Differences from `offer_sent` Webhook

| Feature | `creator_request_created` | `offer_sent` |
|---------|---------------------------|--------------|
| **Trigger** | Brand requests creators | Brand sends offer |
| **Money** | No payment amount | Includes offer amount |
| **Campaign** | Optional campaign_id | Required activation_id |
| **Multiple Creators** | Yes (array of creator_ids) | No (single creator) |
| **Purpose** | Request to join | Direct offer with payment |

---

## RLS Policies

```sql
-- Allow creators to view their own requests
CREATE POLICY "Creators can view their requests"
  ON creator_request_items
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Allow creators to update their request status
CREATE POLICY "Creators can respond to requests"
  ON creator_request_items
  FOR UPDATE
  USING (auth.uid() = creator_id);
```

---

## Current Status

- ✅ DTTracker sends webhook
- ⚠️ Dobbletap needs to implement handler
- ❌ Creators can't see requests yet

---

## Next Steps for Dobbletap Team

1. **Create database tables** (see schema above)
2. **Implement webhook handler** for `creator_request_created` event
3. **Update creator UI** to show requests
4. **Test with DTTracker** using the test payload
5. **Confirm requests are visible** to creators

---

## Questions?

Contact DTTracker team or check:
- [INTEGRATION_COMPLETE_SUMMARY.md](INTEGRATION_COMPLETE_SUMMARY.md) - Overall integration status
- [DOBBLETAP_INTEGRATION_HANDOFF.md](DOBBLETAP_INTEGRATION_HANDOFF.md) - Original handoff doc
- [DOBBLETAP_OFFER_WEBHOOK_SPEC.md](DOBBLETAP_OFFER_WEBHOOK_SPEC.md) - Similar `offer_sent` spec

---

**Document Status**: Draft
**Date**: February 8, 2026
**Author**: DTTracker Team
**For**: Dobbletap Development Team
