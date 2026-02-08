# Debug: Offer Not Showing on Dobbletap

## Problem
- ✅ Campaigns are visible on Dobbletap (public activations work)
- ❌ Offer invitations NOT showing up for creators
- ❌ When brand sends offer, creator doesn't see it

---

## Test Results

### Campaign Sync ✅
```bash
# Synced activation to Dobbletap
Campaign ID: 1763703b-2045-4e29-93e6-8bebe67c831b
Status: OK
```

### Creator Sync ✅
```bash
# Synced @wickhed7 to DTTracker
Creator ID (Dobbletap): 29f99241-53d1-4f78-b9b0-2169f4a15a49
Creator ID (DTTracker): 0be6f5e4-208e-4338-8655-8aa6973990b7
Status: synced
```

### Offer Sync ❌
```bash
# Sent offer_sent webhook
Response: {"error": "Webhook processing failed"}
HTTP: 200 (but generic error)
```

---

## Root Cause Analysis

The `offer_sent` webhook is receiving the request but failing during processing.

### Possible Issues:

#### 1. Campaign Not Found in Dobbletap
**Why**: Dobbletap might be searching by `dttracker_campaign_id` field

**Check**:
```sql
-- On Dobbletap database
SELECT id, title, dttracker_campaign_id, source
FROM campaigns
WHERE dttracker_campaign_id = 'be6502a1-9161-4eee-9f5c-9f422517df1e';
```

**Expected**: Should return the campaign we just synced

**If empty**: The campaign sync didn't work or used wrong field name

---

#### 2. Creator Not Found in Dobbletap
**Why**: Creator might not exist in Dobbletap's database

**Check**:
```sql
-- On Dobbletap database
SELECT id, email, handle, platform
FROM users
WHERE id = '29f99241-53d1-4f78-b9b0-2169f4a15a49';
```

**Expected**: Should return @wickhed7

**If empty**: Need to sync creator to Dobbletap first

---

#### 3. Missing campaign_invitations Table
**Why**: Table might not exist yet

**Check**:
```sql
-- On Dobbletap database
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaign_invitations';
```

**Expected**: Should show columns like:
- id
- campaign_id
- creator_id
- offered_amount
- status
- message

**If empty**: Need to create the table (see DOBBLETAP_OFFER_WEBHOOK_SPEC.md)

---

#### 4. Field Name Mismatch
**Why**: Webhook might be sending `creator_id` but Dobbletap expects `user_id`

**Check webhook handler code**:
```typescript
const { creator_id, activation_id, amount, message } = data;

// Does it look for campaign by activation_id?
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id')
  .eq('dttracker_campaign_id', activation_id)  // ← Check this field
  .single();
```

---

## Debugging Steps for Dobbletap Team

### Step 1: Check Dobbletap Function Logs
```
Supabase Dashboard → Functions → make-server-8061e72e → Logs
```

Look for:
- Recent `offer_sent` webhook calls
- Error messages
- Stack traces

### Step 2: Verify Campaign Exists
```sql
SELECT * FROM campaigns
WHERE source = 'dttracker'
ORDER BY created_at DESC
LIMIT 1;
```

Should show the campaign we just synced.

### Step 3: Verify Creator Exists
```sql
SELECT id, email, handle
FROM users
WHERE handle = '@wickhed7' OR id = '29f99241-53d1-4f78-b9b0-2169f4a15a49';
```

### Step 4: Check if Invitations Table Exists
```sql
SELECT * FROM campaign_invitations LIMIT 1;
```

If error: **Table doesn't exist** - need to create it!

---

## Quick Fixes

### Fix 1: Create campaign_invitations Table
If table doesn't exist, run this migration on Dobbletap:

```sql
CREATE TABLE campaign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL, -- References users(id) but NOT FK due to sync timing
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

### Fix 2: Sync Creator to Dobbletap
If creator doesn't exist, we need to ensure Dobbletap has the creator:

**Option A**: Sync from DTTracker to Dobbletap
```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/creator-sync" \
  -H "Authorization: Bearer [dobbletap-anon-key]" \
  -d '{
    "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
    "email": "bukolafaduagba@gmail.com",
    "handle": "@wickhed7",
    "platform": "tiktok"
  }'
```

**Option B**: Manual insert
```sql
INSERT INTO users (id, email, handle, platform)
VALUES (
  '29f99241-53d1-4f78-b9b0-2169f4a15a49',
  'bukolafaduagba@gmail.com',
  '@wickhed7',
  'tiktok'
)
ON CONFLICT (id) DO NOTHING;
```

### Fix 3: Update Webhook Handler
If the handler exists but has wrong field names:

```typescript
// In offer_sent handler

// Map activation_id to campaign via dttracker_campaign_id
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id')
  .eq('dttracker_campaign_id', data.activation_id)  // ← Use activation_id
  .single();

// OR if using different field:
.eq('source_campaign_id', data.activation_id)
```

---

## Test Command

After fixes, test again:

```bash
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c" \
  -d '{
    "eventType": "offer_sent",
    "timestamp": "2026-02-08T10:00:00Z",
    "data": {
      "activation_id": "be6502a1-9161-4eee-9f5c-9f422517df1e",
      "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
      "amount": 50000,
      "message": "Join our test campaign!"
    }
  }'
```

**Expected Success Response**:
```json
{
  "success": true,
  "invitation_id": "uuid-here"
}
```

---

## Summary

**Next Steps**:
1. ✅ **Check Dobbletap function logs** - See actual error message
2. ✅ **Verify campaign exists** - Query campaigns table
3. ✅ **Verify creator exists** - Query users table
4. ✅ **Check invitations table** - Confirm it exists
5. ✅ **Apply fixes** - Based on what's missing
6. ✅ **Test again** - Should work after fixes

**Most Likely Issue**: `campaign_invitations` table doesn't exist yet on Dobbletap.

**Quick Fix**: Run the CREATE TABLE migration above.
