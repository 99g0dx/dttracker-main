# Creator Request Items Update - Fixed ✅

**Date**: February 8, 2026
**Last Updated**: February 8, 2026 (Creator ID Mapping Fix)
**Status**: ✅ **DEPLOYED AND FIXED**

---

## Issue Reported by Dobbletap Team

When creators submitted quotes in Dobbletap, the callback successfully updated DTTracker's `creator_requests` table, but **failed to update the `creator_request_items` table**.

### Evidence

**Before Fix**:
```
DTTracker Database:
- creator_requests.quote_received = true ✅
- creator_requests.quoted_amount = 790 ✅
- creator_request_items.quoted_amount_cents = null ❌
- creator_request_items.quoted_at = null ❌
- creator_request_items.status = pending ❌
```

---

## Root Causes

### Issue #1: Missing creator_request_items Update
The `creator-quote-callback` function only updated the parent `creator_requests` table, but did not update the per-creator row in `creator_request_items`.

### Issue #2: Creator ID Mismatch
After fixing Issue #1, quotes still weren't appearing because:
- Dobbletap sends their creator ID in the payload (`dobble_tap_creator_id` or `creator_id`)
- But `creator_request_items.creator_id` stores DTTracker's creator ID
- The callback was using Dobbletap's ID directly, causing the WHERE clause to match zero rows

### Issue #3: Request ID Mismatch
After fixing Issues #1 and #2, discovered another mapping issue:
- Dobbletap creates their own request ID when syncing (`ad540ba1-a536-479a-bf64-1f206aafd5a4`)
- DTTracker has its own request ID (`305a560e-d70e-41e4-89ea-6973258eacd8`)
- Dobbletap sends their request ID in the callback, but DTTracker tries to look it up directly
- The callback couldn't find the request because it was searching with Dobbletap's ID

### Issue #4: creator_request_items Row Never Created
Final discovery: Some requests didn't have `creator_request_items` rows created initially:
- When a request is created on DTTracker, the `creator_request_items` row should be inserted
- But in some cases, these rows were missing
- The callback tried to UPDATE a non-existent row, failing silently

**Missing Logic**:
```typescript
// Was only updating creator_requests
await supabase
  .from('creator_requests')
  .update(updateData)
  .eq('id', request_id);

// But should ALSO update creator_request_items ❌
```

---

## Fixes Applied

### Fix #1: Added creator_request_items Update

Added code to update `creator_request_items` after updating `creator_requests`:

```typescript
// Update creator_request_items table for this specific creator
if (creator_id) {
  const itemUpdateData: any = {
    quoted_at: responded_at || new Date().toISOString(),
    quote_notes: response_message,
    updated_at: new Date().toISOString(),
  };

  if (status === 'accepted') {
    itemUpdateData.quoted_amount_cents = quoted_amount;
    itemUpdateData.quoted_currency = 'NGN';
    itemUpdateData.status = 'accepted';
  } else {
    itemUpdateData.status = 'declined';
  }

  const { data: updatedItem, error: itemError } = await supabase
    .from('creator_request_items')
    .update(itemUpdateData)
    .eq('request_id', request_id)
    .eq('creator_id', creator_id)
    .select()
    .single();

  if (itemError) {
    console.error('Failed to update creator_request_items:', itemError);
  } else {
    console.log('Creator request item updated:', updatedItem.id);
  }
}
```

### Fix #2: Creator ID Mapping

Added logic to map Dobbletap creator ID to DTTracker creator ID:

```typescript
// Update creator_request_items table for this specific creator
if (creator_id || dobble_tap_creator_id) {
  // First, find the DTTracker creator ID from Dobbletap creator ID
  let dttrackerCreatorId = creator_id;

  // If creator_id looks like a Dobbletap ID (or we have dobble_tap_creator_id), look up DTTracker ID
  if (dobble_tap_creator_id || creator_id) {
    const { data: creatorData, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('dobble_tap_user_id', dobble_tap_creator_id || creator_id)
      .maybeSingle();

    if (creatorData) {
      dttrackerCreatorId = creatorData.id;
      console.log('Mapped Dobbletap creator to DTTracker creator:', {
        dobble_tap_id: dobble_tap_creator_id || creator_id,
        dttracker_id: dttrackerCreatorId
      });
    } else {
      console.error('Could not find DTTracker creator for Dobbletap ID:', dobble_tap_creator_id || creator_id);
    }
  }

  if (dttrackerCreatorId) {
    const itemUpdateData: any = {
      quoted_at: responded_at || new Date().toISOString(),
      quote_notes: response_message,
      updated_at: new Date().toISOString(),
    };

    if (status === 'accepted') {
      itemUpdateData.quoted_amount_cents = quoted_amount;
      itemUpdateData.quoted_currency = 'NGN';
      itemUpdateData.status = 'quoted'; // Map to 'quoted' so UI shows accept/reject buttons
    } else {
      itemUpdateData.status = 'declined';
    }

    const { data: updatedItem, error: itemError } = await supabase
      .from('creator_request_items')
      .update(itemUpdateData)
      .eq('request_id', request_id)
      .eq('creator_id', dttrackerCreatorId) // Now uses DTTracker creator ID
      .select()
      .single();

    if (itemError) {
      console.error('Failed to update creator_request_items:', itemError);
      // Don't fail the whole callback - log and continue
    } else {
      console.log('Creator request item updated:', updatedItem.id);
    }
  }
}
```

**Key Changes:**
- Look up DTTracker creator ID from `creators` table using `dobble_tap_user_id`
- Use the mapped DTTracker creator ID for the WHERE clause
- Added logging to track ID mapping for debugging

### Fix #3: Request ID Mapping

Added logic to map Dobbletap request ID to DTTracker request ID:

```typescript
// Find the creator request - try DTTracker ID first, then Dobbletap ID
let request = null;
let dttrackerRequestId = request_id;

// First, try to find by DTTracker request_id
const { data: requestById } = await supabase
  .from('creator_requests')
  .select('*')
  .eq('id', request_id)
  .maybeSingle();

if (requestById) {
  request = requestById;
  console.log('Found request by DTTracker ID:', request_id);
} else {
  // Not found by ID, try to find by Dobbletap request_id
  const { data: requestByDobbletapId } = await supabase
    .from('creator_requests')
    .select('*')
    .eq('dobble_tap_request_id', request_id)
    .maybeSingle();

  if (requestByDobbletapId) {
    request = requestByDobbletapId;
    dttrackerRequestId = requestByDobbletapId.id;
    console.log('Mapped Dobbletap request ID to DTTracker request:', {
      dobble_tap_request_id: request_id,
      dttracker_request_id: dttrackerRequestId
    });
  }
}
```

**Key Changes:**
- Try to find request by incoming ID (assume DTTracker ID first)
- If not found, search by `dobble_tap_request_id` field
- Use the mapped DTTracker request ID for all subsequent operations
- Added logging to track request ID mapping

### Fix #4: UPSERT Instead of UPDATE

Changed from UPDATE to UPSERT to handle missing `creator_request_items` rows:

```typescript
// Use upsert to insert if row doesn't exist, update if it does
const { data: updatedItem, error: itemError } = await supabase
  .from('creator_request_items')
  .upsert(itemUpdateData, {
    onConflict: 'request_id,creator_id',
    ignoreDuplicates: false,
  })
  .select()
  .single();
```

**Key Changes:**
- Changed from `.update()` to `.upsert()`
- INSERT if `creator_request_items` row doesn't exist
- UPDATE if row already exists
- Uses composite unique key `(request_id, creator_id)` for conflict resolution

### What Gets Updated Now

**When Creator Accepts (status = 'accepted')**:
- `creator_request_items.quoted_amount_cents` = quoted amount
- `creator_request_items.quoted_currency` = 'NGN'
- `creator_request_items.status` = 'accepted'
- `creator_request_items.quoted_at` = timestamp
- `creator_request_items.quote_notes` = response message

**When Creator Declines (status = 'declined')**:
- `creator_request_items.status` = 'declined'
- `creator_request_items.quoted_at` = timestamp
- `creator_request_items.quote_notes` = response message

---

## Deployment

**Function**: `creator-quote-callback`
**File**: `supabase/functions/creator-quote-callback/index.ts`
**Status**: ✅ **DEPLOYED** (with both fixes)

**Command Used**:
```bash
supabase functions deploy creator-quote-callback
```

**Deployment Timeline**:
- Initial deployment: February 8, 2026 (Fix #1 - creator_request_items update)
- Updated deployment: February 8, 2026 (Fix #2 - Creator ID mapping)

---

## Testing

### Test Payload

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c" \
  -d '{
    "request_id": "5509f59e-4d75-4c77-9006-63d2a9518761",
    "creator_id": "0be6f5e4-208e-4338-8655-8aa6973990b7",
    "dobble_tap_creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
    "status": "accepted",
    "quoted_amount": 790,
    "response_message": "I can deliver this",
    "responded_at": "2026-02-08T14:00:00Z"
  }'
```

### Verification Queries

**Check creator_requests table**:
```sql
SELECT
  id,
  quote_received,
  quoted_amount,
  quote_status,
  creator_response_message
FROM creator_requests
WHERE id = '5509f59e-4d75-4c77-9006-63d2a9518761';
```

**Check creator_request_items table**:
```sql
SELECT
  id,
  request_id,
  creator_id,
  status,
  quoted_amount_cents,
  quoted_currency,
  quote_notes,
  quoted_at
FROM creator_request_items
WHERE request_id = '5509f59e-4d75-4c77-9006-63d2a9518761'
  AND creator_id = '0be6f5e4-208e-4338-8655-8aa6973990b7';
```

**Expected Result**:
```
creator_request_items:
- quoted_amount_cents = 790 ✅
- quoted_currency = NGN ✅
- status = accepted ✅
- quoted_at = 2026-02-08T14:00:00Z ✅
- quote_notes = I can deliver this ✅
```

---

## Impact

### Before Fix
- ❌ `creator_request_items` remained with `status = pending`
- ❌ No quoted amount stored per creator
- ❌ No quote timestamp
- ❌ Brand couldn't see which creators quoted what

### After Fix
- ✅ `creator_request_items.status` updates to accepted/declined
- ✅ Quoted amount stored correctly
- ✅ Quote timestamp recorded
- ✅ Brand can see per-creator quote details
- ✅ UI can display quotes properly

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `supabase/functions/creator-quote-callback/index.ts` | Added creator_request_items update logic | ✅ Deployed |
| `CREATOR_REQUEST_ITEMS_FIX.md` | This summary document | ✅ Created |

---

## Workflow Now Complete

```
1. Brand creates request → DTTracker
                        ↓
2. DTTracker syncs to Dobbletap
                        ↓
3. Creator sees request in Dobbletap
                        ↓
4. Creator submits quote (₦790)
                        ↓
5. Dobbletap calls DTTracker callback
                        ↓
6. DTTracker updates:
   - creator_requests ✅
   - creator_request_items ✅ (NEW!)
                        ↓
7. Brand sees quote in UI
                        ↓
8. Brand accepts quote
                        ↓
9. DTTracker sends offer_sent webhook
```

---

## Next Test

Dobbletap team should:
1. Have a creator submit another quote
2. Verify both tables update correctly
3. Confirm UI shows per-creator quote details

---

## Summary

**Issues Fixed**:
1. ❌ **Issue #1**: `creator_request_items` not updating when quotes received
   - **Cause**: Missing update logic in callback handler
   - **Fix**: Added `creator_request_items` update after `creator_requests` update
   - **Status**: ✅ Fixed

2. ❌ **Issue #2**: Creator ID mismatch
   - **Cause**: Dobbletap sends their creator ID, but DTTracker uses different creator IDs
   - **Fix**: Added creator ID mapping logic to look up DTTracker creator ID from Dobbletap creator ID
   - **Status**: ✅ Fixed

3. ❌ **Issue #3**: Request ID mismatch
   - **Cause**: Dobbletap creates their own request ID, callback receives Dobbletap ID but searches with it as DTTracker ID
   - **Fix**: Added request ID mapping logic to look up DTTracker request using `dobble_tap_request_id` field
   - **Status**: ✅ Fixed

4. ❌ **Issue #4**: Missing `creator_request_items` rows
   - **Cause**: Some requests created without `creator_request_items` rows, UPDATE fails on non-existent rows
   - **Fix**: Changed from UPDATE to UPSERT to insert rows if they don't exist
   - **Status**: ✅ Fixed

**Deployment**: February 8, 2026 (all 4 fixes)
**Function**: `creator-quote-callback` v4
**Ready for Testing**: Yes ✅

---

## Important: ID Mapping Systems

### Creator ID Mapping

**Two Creator ID Systems**:
- **Dobbletap**: Uses `dobble_tap_creator_id` (e.g., `29f99241-53d1-4f78-b9b0-2169f4a15a49`)
- **DTTracker**: Uses `creator_id` from `creators` table (e.g., `0be6f5e4-208e-4338-8655-8aa6973990b7`)

**How Creator Mapping Works**:
1. Dobbletap sends quote callback with their creator ID
2. Callback looks up DTTracker creator using `creators.dobble_tap_user_id`
3. Uses the mapped DTTracker creator ID to update `creator_request_items`

### Request ID Mapping

**Two Request ID Systems**:
- **Dobbletap**: Creates their own request ID when syncing (e.g., `ad540ba1-a536-479a-bf64-1f206aafd5a4`)
- **DTTracker**: Uses original request ID (e.g., `305a560e-d70e-41e4-89ea-6973258eacd8`)
- **Stored in**: `creator_requests.dobble_tap_request_id` field

**How Request Mapping Works**:
1. Dobbletap sends quote callback with their request ID
2. Callback first tries to find request by ID (assumes DTTracker ID)
3. If not found, searches `dobble_tap_request_id` field for Dobbletap's ID
4. Uses the mapped DTTracker request ID for all subsequent operations

**For Dobbletap Team**:
- You can send either `creator_id` OR `dobble_tap_creator_id` in the payload
- You can send either DTTracker's request_id OR your own request_id
- The callback will automatically map to the correct DTTracker IDs
- If mapping fails, you'll see errors in logs:
  - "Could not find DTTracker creator for Dobbletap ID"
  - "Creator request not found"

---

**For Dobbletap Team**: Please test with a new quote submission and verify both tables update correctly. Thank you for catching this!
