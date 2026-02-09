# Quote Workflow Fix - Complete Solution

**Date**: February 9, 2026
**Status**: ✅ **READY TO DEPLOY**

---

## Problem Discovered

The quote accept/reject workflow was only updating `creator_request_items` table but **NOT** updating the `creator_requests` table with the quote-specific fields.

### Root Cause

The UI calls the `respond_creator_quote` RPC function (not the React component we were initially debugging). This RPC function was:

1. ✅ Updating `creator_request_items.status` = 'approved' or 'rejected'
2. ✅ Updating `creator_requests.status` = 'approved', 'quoted', or 'submitted'
3. ❌ **NOT updating** `creator_requests.quote_status` = 'accepted' or 'declined'
4. ❌ **NOT updating** `creator_requests.quote_reviewed_at`
5. ❌ **NOT updating** `creator_requests.quote_reviewed_by`
6. ❌ **NOT triggering** webhook notification to Dobbletap

### Why This Caused Issues

The database had **inconsistent data**:
```sql
-- When user accepted a quote:
creator_request_items.status = 'approved'       ✅ Correct
creator_requests.status = 'approved'            ✅ Correct
creator_requests.quote_status = 'pending'       ❌ Still pending!
creator_requests.quote_reviewed_at = NULL       ❌ Not set!
creator_requests.quote_reviewed_by = NULL       ❌ Not set!
-- Dobbletap webhook = NOT SENT                 ❌ Never notified!
```

---

## Solution Applied

### 1. Fixed RPC Function ✅

**File**: `supabase/migrations/20260209_fix_respond_creator_quote.sql`

**Changes**:
- Now updates `quote_status` = 'accepted' or 'declined' (mapped from 'approved'/'rejected')
- Now updates `quote_reviewed_at` = NOW()
- Now updates `quote_reviewed_by` = auth.uid()

**Key Code Addition**:
```sql
-- Update creator_requests with quote-specific fields
UPDATE public.creator_requests
SET
  quote_status = quote_decision,  -- 'accepted' or 'declined'
  quote_reviewed_at = NOW(),
  quote_reviewed_by = auth.uid(),
  updated_at = NOW()
WHERE id = target_request_id;
```

### 2. Added Webhook Notification ✅

**File**: `src/hooks/useCreatorRequests.ts`

**Changes**:
- Modified `useRespondToCreatorQuote()` hook
- After RPC succeeds, now triggers webhook to Dobbletap
- Webhook sends decision as 'accepted' or 'declined' (not 'approved')

**Key Code Addition**:
```typescript
// In onSuccess callback:
const { error: webhookError } = await supabase.functions.invoke('notify-dobbletap-quote-decision', {
  body: {
    request_id: variables.requestId,
    creator_id: variables.creatorId,
    decision: variables.decision === 'approved' ? 'accepted' : 'declined',
    quoted_amount: requestData.quoted_amount_cents,
    reviewed_by: user?.id,
    reviewed_at: new Date().toISOString(),
  },
});
```

### 3. Data Cleanup Script ✅

**File**: `FIX_ALL_INCONSISTENT_QUOTES.sql`

This script finds and fixes ALL quotes where:
- `creator_request_items.status` = 'approved' BUT
- `creator_requests.quote_status` = 'pending'

---

## Deployment Steps

### Step 1: Run Database Migration

Run this in Supabase SQL Editor:

```bash
# Copy contents of: supabase/migrations/20260209_fix_respond_creator_quote.sql
# Paste into Supabase Dashboard > SQL Editor
# Click "Run"
```

**Expected Output**:
```
CREATE OR REPLACE FUNCTION public.respond_creator_quote
Success. No rows returned
```

### Step 2: Fix Existing Inconsistent Data

Run this in Supabase SQL Editor:

```bash
# Copy contents of: FIX_ALL_INCONSISTENT_QUOTES.sql
# Paste into Supabase Dashboard > SQL Editor
# Click "Run"
```

**Expected Output**:
```
UPDATE 4-5  (number of inconsistent quotes that were fixed)
```

### Step 3: Deploy Frontend Changes

```bash
# The React hook changes are in src/hooks/useCreatorRequests.ts
# Deploy your frontend to production
npm run build
# or your deployment command
```

### Step 4: Test the Fix

1. Go to `/requests` page
2. Find a quote with status "quoted"
3. Click "Accept" or "Reject"
4. Run verification query:

```sql
SELECT
  cr.id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.quote_reviewed_by,
  cri.status as item_status
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
WHERE cr.id = '<your-request-id>';
```

**Expected Result**:
```
quote_status: 'accepted'        ✅
quote_reviewed_at: '2026-02-09...' ✅
quote_reviewed_by: '<user-uuid>'   ✅
item_status: 'approved'            ✅
```

5. Check Dobbletap webhook logs:

```bash
# In Supabase Dashboard > Edge Functions > Logs
# Filter: notify-dobbletap-quote-decision
```

**Expected Log**:
```
Sending webhook to Dobbletap: {
  eventType: 'quote_reviewed',
  data: {
    dobble_tap_request_id: '...',
    dobble_tap_creator_id: '...',
    decision: 'accepted',
    ...
  }
}
Dobbletap notified successfully
```

---

## Status Value Mapping (Unchanged)

This fix maintains the existing status value mapping:

| Action | creator_requests.quote_status | creator_request_items.status |
|--------|------------------------------|------------------------------|
| Creator submits quote | `'pending'` | `'quoted'` |
| Brand accepts quote | `'accepted'` | `'approved'` |
| Brand declines quote | `'declined'` | `'rejected'` |

**Note**: The RPC function accepts decision as 'approved'/'rejected' but the webhook sends it as 'accepted'/'declined' for consistency with the quote_status field.

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `supabase/migrations/20260209_fix_respond_creator_quote.sql` | Fixed RPC to update quote fields | ✅ Created |
| `src/hooks/useCreatorRequests.ts` | Added webhook call after RPC | ✅ Modified |
| `FIX_ALL_INCONSISTENT_QUOTES.sql` | SQL to fix existing data | ✅ Created |
| `QUOTE_WORKFLOW_FIX.md` | This documentation | ✅ Created |

---

## Verification Checklist

After deployment:

- [ ] Run the RPC migration in Supabase
- [ ] Run the data fix SQL script
- [ ] Deploy frontend changes
- [ ] Test accepting a quote from UI
- [ ] Verify `creator_requests.quote_status` = 'accepted'
- [ ] Verify `creator_requests.quote_reviewed_at` is set
- [ ] Verify `creator_requests.quote_reviewed_by` is set
- [ ] Verify `creator_request_items.status` = 'approved'
- [ ] Check webhook logs for successful Dobbletap notification
- [ ] Confirm Dobbletap receives webhook with decision: 'accepted'

---

## Impact

**Before Fix**:
- ❌ Quote decisions only updated item-level status
- ❌ Request-level quote fields stayed NULL
- ❌ No webhook notification to Dobbletap
- ❌ Inconsistent data across tables

**After Fix**:
- ✅ Both tables updated correctly
- ✅ All quote-related fields populated
- ✅ Webhook notification sent to Dobbletap
- ✅ Data consistency maintained

---

## Technical Details

### Call Flow (After Fix)

1. User clicks "Accept" button in UI
2. UI calls `respondToQuoteMutation.mutate()`
3. React hook `useRespondToCreatorQuote()` is triggered
4. Hook calls `creatorRequestsApi.respondToCreatorQuote()`
5. API calls RPC `respond_creator_quote`
6. **RPC updates creator_request_items** (status = 'approved')
7. **RPC updates creator_requests** (quote_status = 'accepted', reviewed_at, reviewed_by)
8. RPC returns success
9. **Hook triggers webhook** to Dobbletap Edge Function
10. Webhook sends notification to Dobbletap's endpoint
11. UI shows success toast

### Why This Approach?

We added the webhook call in the React hook instead of the RPC function because:
- ✅ Simpler - no need for `pg_net` extension
- ✅ Better error handling - webhook failure doesn't fail the quote decision
- ✅ Easier to debug - can see webhook calls in browser network tab
- ✅ More flexible - can add retry logic, logging, etc. in TypeScript

---

**Last Updated**: February 9, 2026
**Version**: 1.0
**Status**: Ready for deployment ✅
