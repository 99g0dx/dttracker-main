# URGENT: Campaign Invitations Not Showing for Creators

## Problem Summary

**What's Working**:
- ✅ DTTracker sends offers via `offer_sent` webhook
- ✅ Dobbletap webhook receives requests (HTTP 200 OK)
- ✅ Webhook returns `{"status": "ok"}`

**What's NOT Working**:
- ❌ **Invitations don't appear in creator's dashboard**
- ❌ **Creators (@wickhed7) can't see offers sent to them**

---

## Test Evidence

### DTTracker Sending Offer:
```json
{
  "eventType": "offer_sent",
  "timestamp": "2026-02-08T04:27:03Z",
  "data": {
    "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
    "activation_id": "be6502a1-9161-4eee-9f5c-9f422517df1e",
    "dttrackerCampaignId": "be6502a1-9161-4eee-9f5c-9f422517df1e",
    "amount": 50000,
    "message": "We'd love to work with you!",
    "activation_title": "Test Campaign",
    "workspace_id": "test-workspace"
  }
}
```

### Dobbletap Response:
```json
{
  "status": "ok"
}
```

**Conclusion**: The webhook handler is **silently failing** - it returns success but doesn't actually create the invitation record.

---

## Root Cause Analysis

The webhook is returning `200 OK` but not creating invitation records. Possible causes:

### 1. Invitation Record Not Being Created (Most Likely)

The webhook handler might be:
- Catching errors silently
- Returning "ok" even when database insert fails
- Not actually executing the INSERT statement

**Check**:
```sql
-- On Dobbletap database
SELECT * FROM campaign_invitations
WHERE creator_id = '29f99241-53d1-4f78-b9b0-2169f4a15a49'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: Should show invitation records
**If empty**: Invitations are NOT being created

---

### 2. Table Doesn't Exist

The `campaign_invitations` table might not exist.

**Check**:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'campaign_invitations';
```

**If empty**: Table doesn't exist - **this is the most likely issue**

**Fix**: Create the table
```sql
CREATE TABLE campaign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  offered_amount NUMERIC NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  dttracker_offer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, creator_id)
);

CREATE INDEX idx_campaign_invitations_creator
  ON campaign_invitations(creator_id, status);

CREATE INDEX idx_campaign_invitations_campaign
  ON campaign_invitations(campaign_id, status);
```

---

### 3. Silent Error Handling

The webhook handler might have this pattern:
```typescript
try {
  await createInvitation(...);
  return { status: 'ok' };  // ← Always returns ok!
} catch (error) {
  console.error(error);
  return { status: 'ok' };  // ← Should return error!
}
```

**Fix**: Return proper errors
```typescript
try {
  const invitation = await createInvitation(...);
  return {
    status: 'ok',
    invitation_id: invitation.id
  };
} catch (error) {
  console.error('Invitation creation failed:', error);
  return {
    error: error.message,
    status: 'failed'
  };
}
```

---

### 4. Campaign Lookup Failing

The webhook might not find the campaign:

**Check**:
```sql
SELECT id, title, dttracker_campaign_id, source_campaign_id
FROM campaigns
WHERE dttracker_campaign_id = 'be6502a1-9161-4eee-9f5c-9f422517df1e'
   OR source_campaign_id = 'be6502a1-9161-4eee-9f5c-9f422517df1e'
   OR id = 'be6502a1-9161-4eee-9f5c-9f422517df1e';
```

**Expected**: Should return the campaign we synced earlier
**If empty**: Campaign not found - need to check field name

---

### 5. Creator Lookup Failing

The creator might not exist:

**Check**:
```sql
SELECT id, email, handle, platform
FROM users
WHERE id = '29f99241-53d1-4f78-b9b0-2169f4a15a49'
   OR handle = '@wickhed7';
```

**Expected**: Should return @wickhed7
**If empty**: Creator doesn't exist in Dobbletap

---

### 6. Creator UI Not Showing Invitations

Invitations might be created but UI isn't displaying them.

**Check**:
```sql
-- If invitations exist
SELECT ci.*, c.title as campaign_title
FROM campaign_invitations ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE ci.creator_id = '29f99241-53d1-4f78-b9b0-2169f4a15a49'
AND ci.status = 'pending';
```

**If rows exist**: UI issue - invitations are in DB but not shown
**If empty**: Invitations aren't being created

---

## Action Items for Dobbletap Team

### STEP 1: Check Function Logs (URGENT)

Go to: `Supabase Dashboard → Functions → make-server-8061e72e → Logs`

Look for:
- Recent `offer_sent` webhook calls
- Any error messages or stack traces
- Database errors
- "Campaign not found" or "Creator not found" messages

### STEP 2: Verify Table Exists

```sql
\d campaign_invitations
```

**If error**: Table doesn't exist - **CREATE IT** (SQL above)

### STEP 3: Check Webhook Handler Code

Look at the `offer_sent` event handler in `/webhooks/dttracker`:

```typescript
if (eventType === 'offer_sent') {
  const { creator_id, activation_id, amount, message } = data;

  // Does this find the campaign?
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('dttracker_campaign_id', activation_id)  // ← Check field name!
    .single();

  if (!campaign) {
    console.error('Campaign not found:', activation_id);
    return res.json({ error: 'Campaign not found' });  // ← Not { status: 'ok' }!
  }

  // Does this create the invitation?
  const { data: invitation, error } = await supabase
    .from('campaign_invitations')  // ← Table must exist!
    .insert({
      campaign_id: campaign.id,
      creator_id: creator_id,
      offered_amount: amount,
      message: message,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Invitation insert failed:', error);
    return res.json({ error: error.message });  // ← Return error!
  }

  return res.json({
    status: 'ok',
    invitation_id: invitation.id  // ← Include ID for verification
  });
}
```

### STEP 4: Manual Test

After fixes, run this to verify invitations are created:

```sql
-- Manually create test invitation
INSERT INTO campaign_invitations (
  campaign_id,
  creator_id,
  offered_amount,
  message,
  status
)
SELECT
  c.id,
  '29f99241-53d1-4f78-b9b0-2169f4a15a49',
  50000,
  'Test invitation',
  'pending'
FROM campaigns c
WHERE c.dttracker_campaign_id = 'be6502a1-9161-4eee-9f5c-9f422517df1e'
LIMIT 1
RETURNING *;
```

**If this works**: The issue is in the webhook handler code
**If this fails**: Database schema issue

### STEP 5: Verify Creator Can See It

After creating an invitation manually:

1. Log in as @wickhed7 on Dobbletap
2. Check "My Invitations" or "Campaign Invites"
3. Should see the test invitation

**If visible**: Webhook isn't creating invitations
**If not visible**: UI isn't querying invitations correctly

---

## Most Likely Fix (90% Probability)

The `campaign_invitations` table doesn't exist. Create it:

```sql
CREATE TABLE campaign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  offered_amount NUMERIC NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, creator_id)
);

CREATE INDEX idx_campaign_invitations_creator
  ON campaign_invitations(creator_id, status);
```

Then update the webhook handler to return proper errors:

```typescript
if (!campaign) {
  return res.status(404).json({
    error: 'Campaign not found',
    activation_id: activation_id
  });
}

if (invitationError) {
  return res.status(500).json({
    error: invitationError.message
  });
}

return res.json({
  status: 'ok',
  invitation_id: invitation.id  // Include this for verification
});
```

---

## Verification After Fix

DTTracker will send this test:

```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c" \
  -d '{
    "eventType": "offer_sent",
    "timestamp": "2026-02-08T10:00:00Z",
    "data": {
      "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
      "activation_id": "be6502a1-9161-4eee-9f5c-9f422517df1e",
      "dttrackerCampaignId": "be6502a1-9161-4eee-9f5c-9f422517df1e",
      "amount": 50000,
      "message": "Test invitation",
      "activation_title": "Test Campaign",
      "workspace_id": "test-workspace"
    }
  }'
```

**Expected response after fix**:
```json
{
  "status": "ok",
  "invitation_id": "uuid-here"
}
```

Then check:
```sql
SELECT * FROM campaign_invitations
WHERE creator_id = '29f99241-53d1-4f78-b9b0-2169f4a15a49'
ORDER BY created_at DESC LIMIT 1;
```

Should show the newly created invitation.

---

## Summary

**Issue**: Dobbletap webhook returns success but doesn't create invitation records.

**Cause**: Most likely `campaign_invitations` table doesn't exist, OR webhook handler catches errors silently.

**Fix**:
1. Create `campaign_invitations` table (SQL above)
2. Update webhook to return proper errors instead of always returning `{status: 'ok'}`
3. Test with curl command above
4. Verify invitation appears in creator dashboard

**Priority**: **CRITICAL** - This blocks the entire brand → creator invitation flow

---

## Contact

For questions or clarifications, reply to this document or check:
- Function logs at Supabase Dashboard
- Database schema with `\d campaign_invitations`
- Test commands in this document
