# For Dobbletap Team - Accept/Reject Quote Integration

**Date**: February 9, 2026
**Status**: 🟡 **ACTION REQUIRED - Dobbletap UI/Backend Implementation Needed**

---

## Current Status Summary

### ✅ What's Working

1. **SYNC_API_KEY Configured** ✅
   - Both platforms now use: `3d529b3a8701606036a97825c6f0caecd4abdd188faebe256c2fa6b845911be2`
   - Authentication working correctly

2. **Quote Submission Flow** ✅
   - Creators can submit quotes on Dobbletap
   - Quotes flow to DTTracker via callback
   - DTTracker displays quotes correctly (₦68,000 format fixed)

3. **Accept/Reject Functionality on DTTracker** ✅
   - Brands can accept or reject quotes from DTTracker UI
   - Both `creator_requests` and `creator_request_items` tables update correctly
   - Database proof: Quotes showing `status: "approved"` after acceptance

---

## What Happens When Brand Accepts/Rejects Quote

### Brand Accepts Quote on DTTracker

**Database Updates**:
```sql
-- creator_requests table
UPDATE creator_requests
SET
  quote_status = 'accepted',
  quote_reviewed_at = '2026-02-09T10:30:00Z',
  quote_reviewed_by = 'brand_user_id'
WHERE id = 'request_id';

-- creator_request_items table
UPDATE creator_request_items
SET
  status = 'accepted',
  updated_at = '2026-02-09T10:30:00Z'
WHERE request_id = 'request_id'
  AND creator_id = 'creator_id';
```

**What This Means**:
- Brand has approved the creator's quote
- Campaign can proceed with this creator
- Creator should be notified and able to start work

### Brand Declines Quote on DTTracker

**Database Updates**:
```sql
-- creator_requests table
UPDATE creator_requests
SET
  quote_status = 'declined',
  quote_reviewed_at = '2026-02-09T10:30:00Z',
  quote_reviewed_by = 'brand_user_id'
WHERE id = 'request_id';

-- creator_request_items table
UPDATE creator_request_items
SET
  status = 'declined',
  updated_at = '2026-02-09T10:30:00Z'
WHERE request_id = 'request_id'
  AND creator_id = 'creator_id';
```

**What This Means**:
- Brand has rejected the creator's quote
- Creator should be notified
- Creator can submit a revised quote if brand allows

---

## What Dobbletap Needs to Implement

### Option 1: Webhook Notification (Recommended)

**Setup**: DTTracker will send webhook to Dobbletap when quote is accepted/rejected

**Webhook Endpoint** (on Dobbletap side):
```
POST https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker/quote-decision
```

**Headers**:
```
Content-Type: application/json
Authorization: Bearer 3d529b3a8701606036a97825c6f0caecd4abdd188faebe256c2fa6b845911be2
```

**Payload Format**:
```json
{
  "eventType": "quote_reviewed",
  "timestamp": "2026-02-09T10:30:00Z",
  "data": {
    "request_id": "dttracker-request-uuid",
    "dobble_tap_request_id": "your-dobbletap-request-uuid",
    "creator_id": "dttracker-creator-uuid",
    "dobble_tap_creator_id": "your-dobbletap-creator-uuid",
    "decision": "accepted",
    "quoted_amount": 68000,
    "reviewed_by": "brand-user-email@example.com",
    "reviewed_at": "2026-02-09T10:30:00Z"
  }
}
```

**Field Definitions**:
- `eventType`: Always `"quote_reviewed"`
- `decision`: `"accepted"` or `"declined"`
- `quoted_amount`: The amount that was quoted (in Naira)
- `request_id`: DTTracker's request ID
- `dobble_tap_request_id`: Your original request ID (for easy mapping)
- `creator_id`: DTTracker's creator ID
- `dobble_tap_creator_id`: Your original creator ID (for easy mapping)

**What You Should Do**:
1. Create webhook endpoint on your platform
2. Validate `Authorization: Bearer <SYNC_API_KEY>`
3. Update your campaign status based on `decision`
4. Notify the creator via your notification system
5. Update your UI to show the decision

---

### Option 2: Polling (Alternative)

If webhooks are complex to implement right now, you can poll DTTracker's database:

**Setup**: Periodically check for quote status changes

**Query Example**:
```sql
SELECT
  cr.id,
  cr.dobble_tap_request_id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.quote_reviewed_by,
  cri.creator_id,
  cri.status,
  c.dobble_tap_user_id
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.dobble_tap_request_id IN ('your-request-ids')
  AND cr.quote_status IN ('accepted', 'declined')
  AND cr.quote_reviewed_at > 'last-checked-timestamp';
```

**Polling Frequency**: Every 30-60 seconds recommended

**Note**: Webhooks (Option 1) are preferred for real-time notifications.

---

## UI/Backend Changes Needed on Dobbletap

### 1. Update Campaign Status

When quote is **accepted**:
```typescript
// Dobbletap backend
campaignStatus = 'in_progress' // or 'active'
creatorStatus = 'accepted'
notifyCreator({
  message: 'Your quote was accepted! You can start working on the campaign.',
  campaignId: dobble_tap_request_id,
  decision: 'accepted'
})
```

When quote is **declined**:
```typescript
// Dobbletap backend
campaignStatus = 'declined'
creatorStatus = 'declined'
notifyCreator({
  message: 'Your quote was declined by the brand.',
  campaignId: dobble_tap_request_id,
  decision: 'declined'
})
```

### 2. Creator Notification UI

**Accepted Quote**:
```
✅ Great news! Your quote of ₦68,000 was accepted by [Brand Name]

Next Steps:
• Start working on the campaign deliverables
• Submit your content for review by [deadline]
• You'll be paid upon completion

[View Campaign Details]
```

**Declined Quote**:
```
❌ Your quote of ₦68,000 was declined by [Brand Name]

What's Next:
• You can submit a revised quote
• Or wait for other opportunities

[Submit New Quote] [View Other Campaigns]
```

### 3. Campaign Dashboard Updates

Show quote decision status on campaign cards:

```
Campaign: [Brand Name] - Product Promotion

Status: ✅ Quote Accepted
Quote: ₦68,000
Reviewed: Feb 9, 2026 10:30 AM

[Start Working] [View Brief]
```

or

```
Campaign: [Brand Name] - Product Promotion

Status: ❌ Quote Declined
Quote: ₦68,000
Reviewed: Feb 9, 2026 10:30 AM

[Submit New Quote] [View Other Campaigns]
```

---

## Implementation Checklist

### Backend Tasks
- [ ] Create webhook endpoint at `/webhooks/dttracker/quote-decision`
- [ ] Validate `Authorization: Bearer <SYNC_API_KEY>`
- [ ] Parse webhook payload (`eventType`, `decision`, `quoted_amount`)
- [ ] Update campaign status in your database
- [ ] Update creator campaign status
- [ ] Trigger creator notification system
- [ ] Handle edge cases (duplicate webhooks, missing data)

### Frontend Tasks
- [ ] Add "Quote Accepted" badge/status in creator dashboard
- [ ] Add "Quote Declined" badge/status in creator dashboard
- [ ] Show notification toast when quote decision received
- [ ] Update campaign card UI to show decision
- [ ] Add "Start Working" button for accepted campaigns
- [ ] Add "Submit New Quote" option for declined campaigns
- [ ] Show decision timestamp ("Reviewed: Feb 9, 10:30 AM")

### Notification Tasks
- [ ] Send in-app notification to creator
- [ ] Send email notification to creator (optional)
- [ ] Send push notification to creator (optional)
- [ ] Include campaign details and next steps in notification

---

## Testing Plan

### Test Case 1: Accept Quote Flow

**Setup**:
1. Have a creator submit a quote on Dobbletap
2. Verify quote appears in DTTracker pending quotes list

**Execute**:
1. Brand accepts quote from DTTracker UI
2. DTTracker updates database

**Verify on Dobbletap**:
- [ ] Webhook received at your endpoint (or polling detects change)
- [ ] Campaign status updated to "accepted" / "in_progress"
- [ ] Creator receives notification
- [ ] Creator dashboard shows "Quote Accepted" status
- [ ] "Start Working" button appears
- [ ] Campaign details accessible

### Test Case 2: Decline Quote Flow

**Setup**:
1. Have a creator submit a quote on Dobbletap
2. Verify quote appears in DTTracker pending quotes list

**Execute**:
1. Brand declines quote from DTTracker UI
2. DTTracker updates database

**Verify on Dobbletap**:
- [ ] Webhook received at your endpoint (or polling detects change)
- [ ] Campaign status updated to "declined"
- [ ] Creator receives notification
- [ ] Creator dashboard shows "Quote Declined" status
- [ ] "Submit New Quote" option available
- [ ] Creator can view other opportunities

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ACCEPT/REJECT FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. Creator submits quote on Dobbletap
         ↓
2. Dobbletap → DTTracker (callback with quote)
         ↓
3. DTTracker displays quote to brand
         ↓
4. Brand clicks [Accept] or [Decline]
         ↓
5. DTTracker updates database:
   • creator_requests.quote_status = 'accepted'/'declined'
   • creator_request_items.status = 'accepted'/'declined'
         ↓
6. 🔄 DTTracker → Dobbletap (webhook with decision)  ⬅ YOU IMPLEMENT THIS
         ↓
7. Dobbletap updates campaign status
         ↓
8. Dobbletap notifies creator
         ↓
9. Creator sees decision in Dobbletap UI
```

**Step 6 is what you need to implement!**

---

## API Endpoints Summary

### From Dobbletap to DTTracker (Already Working ✅)

**Quote Submission Callback**:
```
POST https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback
Authorization: Bearer 3d529b3a8701606036a97825c6f0caecd4abdd188faebe256c2fa6b845911be2

Payload:
{
  "request_id": "your-request-id",
  "creator_id": "your-creator-id",
  "status": "accepted",
  "quoted_amount": 68000,
  "response_message": "I can deliver",
  "responded_at": "2026-02-09T10:00:00Z"
}
```

### From DTTracker to Dobbletap (Action Required 🔄)

**Quote Decision Webhook**:
```
POST https://your-dobbletap-url.com/webhooks/dttracker/quote-decision
Authorization: Bearer 3d529b3a8701606036a97825c6f0caecd4abdd188faebe256c2fa6b845911be2

Payload:
{
  "eventType": "quote_reviewed",
  "timestamp": "2026-02-09T10:30:00Z",
  "data": {
    "dobble_tap_request_id": "your-request-id",
    "dobble_tap_creator_id": "your-creator-id",
    "decision": "accepted",
    "quoted_amount": 68000,
    "reviewed_at": "2026-02-09T10:30:00Z"
  }
}
```

**Please provide us with your webhook URL** so we can configure it on DTTracker side.

---

## Example Response Handlers

### Webhook Handler (Recommended)

```typescript
// Dobbletap webhook endpoint
app.post('/webhooks/dttracker/quote-decision', async (req, res) => {
  // 1. Verify authorization
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${SYNC_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Parse payload
  const { eventType, timestamp, data } = req.body;

  if (eventType !== 'quote_reviewed') {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  const {
    dobble_tap_request_id,
    dobble_tap_creator_id,
    decision,
    quoted_amount,
    reviewed_at
  } = data;

  // 3. Update campaign status
  await db.campaigns.update({
    where: { id: dobble_tap_request_id },
    data: {
      status: decision === 'accepted' ? 'in_progress' : 'declined',
      reviewed_at: reviewed_at
    }
  });

  // 4. Update creator campaign item
  await db.creator_campaigns.update({
    where: {
      campaign_id: dobble_tap_request_id,
      creator_id: dobble_tap_creator_id
    },
    data: {
      status: decision
    }
  });

  // 5. Notify creator
  await notifyCreator(dobble_tap_creator_id, {
    type: decision === 'accepted' ? 'quote_accepted' : 'quote_declined',
    campaignId: dobble_tap_request_id,
    quotedAmount: quoted_amount,
    reviewedAt: reviewed_at
  });

  // 6. Return success
  return res.status(200).json({
    success: true,
    message: 'Quote decision processed',
    campaign_id: dobble_tap_request_id
  });
});
```

### Polling Handler (Alternative)

```typescript
// Dobbletap polling service
setInterval(async () => {
  // Get campaigns with pending quotes
  const campaigns = await getCampaignsWithPendingQuotes();

  for (const campaign of campaigns) {
    // Query DTTracker database for status
    const status = await checkQuoteStatus(campaign.dttracker_request_id);

    if (status.quote_status === 'accepted' || status.quote_status === 'declined') {
      // Update campaign
      await updateCampaignStatus(campaign.id, status.quote_status);

      // Notify creator
      await notifyCreator(campaign.creator_id, {
        decision: status.quote_status,
        campaignId: campaign.id
      });
    }
  }
}, 30000); // Check every 30 seconds
```

---

## Next Steps

### Immediate Actions

1. **Decide on Integration Approach**:
   - ⭐ **Webhook** (recommended for real-time updates)
   - OR **Polling** (simpler but less real-time)

2. **If Using Webhooks**:
   - Create webhook endpoint on your platform
   - Share webhook URL with DTTracker team
   - We'll configure DTTracker to send webhooks to your endpoint

3. **If Using Polling**:
   - Implement polling service to check DTTracker database
   - Set appropriate polling frequency (30-60 seconds)

4. **Implement UI/UX**:
   - Add quote decision badges to creator dashboard
   - Create notification system for creators
   - Add action buttons ("Start Working", "Submit New Quote")

5. **Test End-to-End**:
   - Submit test quote from Dobbletap
   - Accept/decline from DTTracker
   - Verify creator sees decision on Dobbletap

---

## Support & Questions

If you need help implementing:

**Technical Questions**:
- Webhook payload format
- Authentication setup
- Database query examples
- Error handling

**Integration Questions**:
- Best approach (webhook vs polling)
- Testing strategy
- Edge case handling

**Contact**: Share questions in our integration channel or provide your webhook URL when ready.

---

## Summary

| Component | Status | Owner |
|-----------|--------|-------|
| SYNC_API_KEY Configuration | ✅ Done | Both teams |
| Quote submission callback | ✅ Working | Dobbletap → DTTracker |
| Accept/Reject on DTTracker UI | ✅ Working | DTTracker |
| Accept/Reject webhook/notification | 🔄 **Pending** | **DTTracker → Dobbletap** |
| Creator notification on Dobbletap | 🔄 **Pending** | **Dobbletap** |
| UI updates for quote decisions | 🔄 **Pending** | **Dobbletap** |

---

**Status**: 🟡 **Waiting for Dobbletap to implement webhook endpoint and UI/backend changes**

**Last Updated**: February 9, 2026
**Version**: 1.0
