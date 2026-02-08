# Dobbletap Webhook: Offer/Invitation Events

## Missing Webhook Handler - URGENT

DTTracker is sending `offer_sent` events to Dobbletap but there's **no handler** on the Dobbletap side to receive them!

This is why:
- ✅ Brand sends offer on DTTracker → balance deducted
- ❌ Offer never reaches Dobbletap → creator doesn't see invitation
- ❌ Money is deducted but nothing happens

---

## Webhook Endpoint Needed

**Endpoint**: `/webhooks/dttracker` (same endpoint, new event type)
**Event Type**: `offer_sent`
**Direction**: DTTracker → Dobbletap

---

## Event Payload

```json
{
  "eventType": "offer_sent",
  "timestamp": "2026-02-08T12:34:56.789Z",
  "data": {
    "creator_id": "uuid",                    // Dobbletap creator ID
    "activation_id": "uuid",                 // DTTracker activation ID
    "dttrackerCampaignId": "uuid",          // Same as activation_id
    "amount": 200,                           // Offer amount in NGN
    "message": "Hi, join this campaign!",    // Optional message from brand
    "activation_title": "Campaign Title",    // Campaign name
    "workspace_id": "uuid"                   // Brand workspace ID
  }
}
```

---

## What Dobbletap Should Do

When receiving this webhook, Dobbletap should:

1. **Find the creator** by `creator_id` (Dobbletap's user ID)
2. **Find/create the campaign** using `dttrackerCampaignId` (should already exist from campaign sync)
3. **Create an invitation record**:
   ```sql
   INSERT INTO campaign_invitations (
     campaign_id,
     creator_id,
     offered_amount,
     message,
     status,
     invited_at
   ) VALUES (
     campaign.id,
     data.creator_id,
     data.amount,
     data.message,
     'pending',
     NOW()
   );
   ```
4. **Send notification** to creator (in-app, email, push, etc.)
5. **Return success** `200 OK`

---

## Example Implementation

```typescript
// In /webhooks/dttracker endpoint on Dobbletap

if (eventType === 'offer_sent') {
  const { creator_id, activation_id, amount, message } = data;

  // Find campaign by DTTracker ID
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('dttracker_campaign_id', activation_id)
    .single();

  if (!campaign) {
    return res.status(404).json({
      error: 'Campaign not found',
      event_id: webhookEvent.id
    });
  }

  // Create invitation
  const { data: invitation } = await supabase
    .from('campaign_invitations')
    .insert({
      campaign_id: campaign.id,
      creator_id: creator_id,
      offered_amount: amount,
      message: message,
      status: 'pending',
      invited_at: timestamp,
      dttracker_offer_id: null, // Optional: track DTTracker offer ID
    })
    .select()
    .single();

  // Send notification to creator
  await notifyCreator(creator_id, {
    type: 'campaign_invitation',
    campaign_id: campaign.id,
    invitation_id: invitation.id,
    amount: amount,
  });

  return res.status(200).json({
    success: true,
    invitation_id: invitation.id,
  });
}
```

---

## Database Schema Needed

If Dobbletap doesn't have a `campaign_invitations` table yet:

```sql
CREATE TABLE campaign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_amount NUMERIC NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  dttracker_offer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, creator_id)
);

CREATE INDEX idx_campaign_invitations_creator ON campaign_invitations(creator_id, status);
CREATE INDEX idx_campaign_invitations_campaign ON campaign_invitations(campaign_id, status);
```

---

## Creator UI Flow

Once invitation is created, the creator should see:

1. **Notification badge** on Dobbletap dashboard
2. **Invitation card** with:
   - Campaign title
   - Offered amount: ₦200
   - Brand message
   - Campaign details (deadline, requirements)
   - **Accept** / **Decline** buttons
3. **When accepted**:
   - Creator joins campaign
   - DTTracker gets notified (future webhook: `invitation_accepted`)
   - Creator can start working on campaign
4. **When declined**:
   - Invitation marked as declined
   - DTTracker gets notified (future webhook: `invitation_declined`)
   - Brand can see decline status

---

## Testing

After implementing the handler, test with:

```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/webhooks/dttracker" \
  -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "offer_sent",
    "timestamp": "2026-02-08T12:00:00Z",
    "data": {
      "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
      "activation_id": "be6502a1-9161-4eee-9f5c-9f422517df1e",
      "dttrackerCampaignId": "be6502a1-9161-4eee-9f5c-9f422517df1e",
      "amount": 200,
      "message": "Join this campaign!",
      "activation_title": "Test Campaign",
      "workspace_id": "workspace-uuid"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "invitation_id": "invitation-uuid"
}
```

---

## Error Handling

Handle these cases:

| Error | HTTP Code | Action |
|-------|-----------|--------|
| Creator not found | 404 | Return error, DTTracker will retry |
| Campaign not found | 404 | Return error (campaign might not have synced yet) |
| Duplicate invitation | 200 | Update existing invitation with new amount/message |
| Database error | 500 | Return error, DTTracker will retry |

---

## Priority: URGENT

**This is blocking the brand → creator invitation flow!**

Without this webhook handler:
- Brands can send offers but creators never see them
- Money is deducted from brand wallets with no result
- Integration appears broken to users

**Estimated effort**: 1-2 hours
- Add event handler to existing webhook endpoint
- Create `campaign_invitations` table
- Implement notification logic
- Test with DTTracker

---

## Questions?

- **Q**: What if campaign doesn't exist yet?
  **A**: Return 404. DTTracker will queue for retry. Campaign should be synced before offers are sent.

- **Q**: What if creator already joined campaign?
  **A**: Check if creator is already a participant. If yes, update invitation to "accepted" status automatically.

- **Q**: Should we notify DTTracker when creator accepts/declines?
  **A**: Yes! We'll need reverse webhooks `invitation_accepted` and `invitation_declined` (future work).

- **Q**: What about offer expiration?
  **A**: Add `expires_at` field to invitations table. Run cron to auto-expire old pending invitations.

---

**Next Steps**:
1. ✅ DTTracker updated to log sync errors
2. ⏳ Dobbletap implements `offer_sent` webhook handler
3. ⏳ Test end-to-end invitation flow
4. ⏳ Implement reverse webhooks for acceptance/decline
