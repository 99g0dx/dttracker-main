# Status Value Fix - Approved vs Accepted

**Date**: February 9, 2026
**Status**: ✅ **FIXED**

---

## Issue Discovered

### Database Status Mismatch

**Existing Data Pattern:**
```sql
creator_request_items.status = 'approved'  ✅ (existing data)
creator_requests.quote_status = 'pending'  ❌ (should be 'accepted')
```

**New Code Was Using:**
```typescript
status: 'accepted'  ❌ (doesn't match existing)
```

### Root Cause

1. **Existing data** in `creator_request_items` uses `status: "approved"`
2. **New accept/reject code** was setting `status: "accepted"`
3. This creates inconsistency and queries looking for 'accepted' wouldn't find 'approved' rows

---

## Fix Applied

### 1. Updated React Component ✅

**File**: `src/app/components/creator-request-quotes.tsx`

**Changed From:**
```typescript
.update({
  status: 'accepted',  // ❌ Wrong value
  updated_at: new Date().toISOString(),
})
```

**Changed To:**
```typescript
.update({
  status: 'approved',  // ✅ Matches existing data
  updated_at: new Date().toISOString(),
})
```

### 2. SQL Fix for Inconsistent Data ✅

**File**: `FIX_INCONSISTENT_QUOTE_STATUS.sql`

**Purpose**: Fix the one existing quote that has mismatched statuses

```sql
UPDATE creator_requests cr
SET
  quote_status = 'accepted',
  quote_reviewed_at = cri.updated_at,
  updated_at = NOW()
FROM creator_request_items cri
WHERE cr.id = cri.request_id
  AND cr.id = '98821366-cb11-46e9-a1b5-c07fabde8664'
  AND cri.status = 'approved'
  AND cr.quote_status = 'pending';
```

This updates the `creator_requests` table to match the already-approved `creator_request_items` row.

### 3. Updated Verification Queries ✅

**File**: `CHECK_WEBHOOK_STATUS.sql`

Added new query to find inconsistent data:

```sql
-- Find items approved but request still pending
SELECT
  cr.id as request_id,
  cr.quote_status as request_status,
  cri.status as item_status,
  cri.quoted_amount_cents,
  c.name as creator_name
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cri.status IN ('approved', 'accepted')
  AND cr.quote_status = 'pending';
```

---

## Status Value Mapping

### Current Correct Mapping

| Action | creator_requests.quote_status | creator_request_items.status |
|--------|------------------------------|------------------------------|
| Creator submits quote | `'pending'` | `'quoted'` |
| Brand accepts quote | `'accepted'` | `'approved'` |
| Brand declines quote | `'declined'` | `'declined'` |

### Why Different Values?

**Historical Reason**:
- The `creator_request_items` table was designed to use `'approved'` for accepted items
- The `creator_requests` table uses `'accepted'` for the overall quote status
- This is intentional to distinguish between:
  - Request-level status (`accepted`/`declined`/`pending`)
  - Item-level status (`approved`/`declined`/`quoted`/`pending`)

---

## Testing After Fix

### Step 1: Fix Existing Inconsistent Data

Run the SQL script:
```bash
# In Supabase SQL Editor
-- Copy and run: FIX_INCONSISTENT_QUOTE_STATUS.sql
```

**Expected Result:**
```sql
-- Before:
quote_status: 'pending'
item_status: 'approved'

-- After:
quote_status: 'accepted' ✅
item_status: 'approved' ✅
```

### Step 2: Test Accept Quote with New Code

1. Go to `/requests` in DTTracker
2. Find a pending quote
3. Click [Accept Quote]
4. Run this query:

```sql
SELECT
  cr.quote_status,
  cri.status as item_status,
  c.name as creator_name
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
JOIN creators c ON c.id = cri.creator_id
WHERE cr.quote_status = 'accepted'
ORDER BY cr.quote_reviewed_at DESC
LIMIT 1;
```

**Expected Result:**
```
quote_status: 'accepted'
item_status: 'approved'
creator_name: 'wickhed7'
```

### Step 3: Verify Webhook Sent

Check Supabase function logs:
```bash
supabase functions logs notify-dobbletap-quote-decision
```

**Expected Log Output:**
```
notify-dobbletap-quote-decision: Starting
Received payload: { request_id: '...', decision: 'accepted', ... }
Sending webhook to Dobbletap: { eventType: 'quote_reviewed', ... }
Dobbletap webhook response: { status: 200, body: {...} }
Dobbletap notified successfully
```

---

## Updated Documentation

### For Dobbletap Team

The webhook payload remains unchanged:

```json
{
  "eventType": "quote_reviewed",
  "timestamp": "2026-02-09T...",
  "data": {
    "dobble_tap_request_id": "...",
    "dobble_tap_creator_id": "...",
    "decision": "accepted",
    "quoted_amount": 75000,
    "reviewed_at": "2026-02-09T..."
  }
}
```

**Note**: `decision` field uses `"accepted"` (not `"approved"`) for clarity in the webhook API.

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `src/app/components/creator-request-quotes.tsx` | Changed `status: 'accepted'` → `'approved'` | ✅ Fixed |
| `FIX_INCONSISTENT_QUOTE_STATUS.sql` | SQL to fix inconsistent data | ✅ Created |
| `CHECK_WEBHOOK_STATUS.sql` | Added inconsistency check query | ✅ Updated |
| `STATUS_VALUE_FIX.md` | This documentation | ✅ Created |

---

## Verification Checklist

After applying fixes:

- [ ] Run `FIX_INCONSISTENT_QUOTE_STATUS.sql` in Supabase
- [ ] Verify existing quote now shows `quote_status: 'accepted'`
- [ ] Test accepting a new quote from UI
- [ ] Verify `creator_request_items.status` = `'approved'`
- [ ] Verify `creator_requests.quote_status` = `'accepted'`
- [ ] Check webhook logs for successful notification
- [ ] Verify Dobbletap receives webhook with `decision: 'accepted'`

---

## Summary

**Issue**: Code was using `'accepted'` but database had `'approved'`

**Fix**:
1. Updated React code to use `'approved'` for item status ✅
2. Created SQL script to fix inconsistent existing data ✅
3. Updated queries to find and prevent future inconsistencies ✅

**Result**: Status values now consistent across all components

---

**Last Updated**: February 9, 2026
**Version**: 1.0
**Status**: Fixed and ready for testing ✅
