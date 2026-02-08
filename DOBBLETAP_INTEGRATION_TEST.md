# Dobbletap ↔ DTTracker Integration Test Guide

**Date**: February 8, 2026
**Purpose**: End-to-end testing of creator request quote workflow
**Status**: Ready for testing

---

## Overview

This document provides step-by-step testing instructions for both DTTracker and Dobbletap teams to verify the quote workflow integration.

---

## Part 1: DTTracker Test Setup

### Test Data
- **Test Creator**: wickhed7 (ID: `0be6f5e4-208e-4338-8655-8aa6973990b7`)
- **Dobbletap Creator ID**: `29f99241-53d1-4f78-b9b0-2169f4a15a49`

### Step 1: Create Test Creator Request

```sql
-- Insert test creator request
INSERT INTO creator_requests (
  id,
  user_id,
  campaign_type,
  campaign_brief,
  deliverables,
  posts_per_creator,
  usage_rights,
  deadline,
  urgency,
  contact_person_name,
  contact_person_email,
  status,
  created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM profiles LIMIT 1), -- Use first available user
  'brand_promotion',
  'Test campaign for Dobbletap integration testing',
  ARRAY['tiktok_post', 'instagram_reel']::text[],
  1,
  'repost_brand_pages',
  NOW() + INTERVAL '7 days',
  'normal',
  'Test Contact',
  'test@example.com',
  'submitted',
  NOW()
) RETURNING id;
```

Save the returned UUID as `TEST_REQUEST_ID`.

### Step 2: Add Creator to Request

```sql
-- Insert creator_request_items
INSERT INTO creator_request_items (
  request_id,
  creator_id,
  status,
  created_at
) VALUES (
  'TEST_REQUEST_ID', -- Replace with actual ID from Step 1
  '0be6f5e4-208e-4338-8655-8aa6973990b7',
  'pending',
  NOW()
);
```

### Step 3: Trigger Sync to Dobbletap

```bash
# Call the create-creator-request function
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/create-creator-request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "request_id": "TEST_REQUEST_ID"
  }'
```

### Step 4: Verify Sync

```sql
-- Check if request was synced
SELECT
  id,
  dobble_tap_request_id,
  synced_to_dobble_tap
FROM creator_requests
WHERE id = 'TEST_REQUEST_ID';
```

**Expected Result**:
- `synced_to_dobble_tap`: `true`
- `dobble_tap_request_id`: A UUID from Dobbletap

Save the `dobble_tap_request_id` as `DOBBLETAP_REQUEST_ID`.

---

## Part 2: Dobbletap Testing (For Dobbletap Team)

### What DTTracker Sends

When DTTracker syncs a creator request to Dobbletap, it sends:

```json
{
  "eventType": "creator_request_created",
  "timestamp": "2026-02-08T15:00:00Z",
  "data": {
    "request_id": "TEST_REQUEST_ID",
    "campaign_type": "brand_promotion",
    "campaign_brief": "Test campaign for Dobbletap integration testing",
    "deliverables": ["tiktok_post", "instagram_reel"],
    "posts_per_creator": 1,
    "usage_rights": "repost_brand_pages",
    "deadline": "2026-02-15T15:00:00Z",
    "urgency": "normal",
    "contact_person_name": "Test Contact",
    "contact_person_email": "test@example.com",
    "creator_ids": ["29f99241-53d1-4f78-b9b0-2169f4a15a49"],
    "total_creators": 1,
    "dttracker_creator_ids": ["0be6f5e4-208e-4338-8655-8aa6973990b7"]
  }
}
```

### What Dobbletap Should Return

```json
{
  "id": "DOBBLETAP_REQUEST_ID",
  "success": true,
  "message": "Request created successfully"
}
```

**CRITICAL**: The `id` field MUST be included in the response. DTTracker stores this as `dobble_tap_request_id`.

### What Dobbletap Should Store

When receiving this request, Dobbletap should store:

1. **Dobbletap's Request ID**: Your own UUID (e.g., `9ab7cc12-65b1-44de-b0dd-e1254feaa891`)
2. **DTTracker's Request ID**: `request_id` from the payload (e.g., `16021054-55bb-4edb-8a9c-6deac4fdbda3`)
3. **Creator Mapping**:
   - Dobbletap creator ID: `29f99241-53d1-4f78-b9b0-2169f4a15a49`
   - DTTracker creator ID: `0be6f5e4-208e-4338-8655-8aa6973990b7`

### Test Quote Submission

Have a creator submit a quote on Dobbletap side with:
- **Amount**: 50000 (50,000 Naira / 50 kobo)
- **Status**: accepted
- **Message**: "Test quote for integration"

### What Dobbletap Should Send Back (Quote Callback)

**Endpoint**: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c
```

**Payload** (OPTION 1 - Send Dobbletap IDs):
```json
{
  "request_id": "DOBBLETAP_REQUEST_ID",
  "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
  "status": "accepted",
  "quoted_amount": 50000,
  "response_message": "Test quote for integration",
  "responded_at": "2026-02-08T15:30:00Z"
}
```

**Payload** (OPTION 2 - Send DTTracker IDs - PREFERRED):
```json
{
  "request_id": "TEST_REQUEST_ID",
  "creator_id": "0be6f5e4-208e-4338-8655-8aa6973990b7",
  "dobble_tap_creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
  "status": "accepted",
  "quoted_amount": 50000,
  "response_message": "Test quote for integration",
  "responded_at": "2026-02-08T15:30:00Z"
}
```

**Note**: DTTracker's callback can handle BOTH options. It will automatically map Dobbletap IDs to DTTracker IDs.

---

## Part 3: Verification (DTTracker Side)

### Step 1: Check creator_requests Table

```sql
SELECT
  id,
  quote_received,
  quoted_amount,
  quote_status,
  creator_response_message,
  quote_received_at
FROM creator_requests
WHERE id = 'TEST_REQUEST_ID';
```

**Expected Result**:
- `quote_received`: `true`
- `quoted_amount`: `50000`
- `quote_status`: `pending`
- `creator_response_message`: `"Test quote for integration"`
- `quote_received_at`: Timestamp of callback

### Step 2: Check creator_request_items Table

```sql
SELECT
  cri.id,
  cri.status,
  cri.quoted_amount_cents,
  cri.quoted_currency,
  cri.quoted_at,
  cri.quote_notes,
  c.name,
  c.dobble_tap_user_id
FROM creator_request_items cri
JOIN creators c ON c.id = cri.creator_id
WHERE cri.request_id = 'TEST_REQUEST_ID';
```

**Expected Result**:
- `status`: `'quoted'`
- `quoted_amount_cents`: `50000`
- `quoted_currency`: `'NGN'`
- `quoted_at`: Timestamp
- `quote_notes`: `"Test quote for integration"`
- `name`: `'wickhed7'`
- `dobble_tap_user_id`: `'29f99241-53d1-4f78-b9b0-2169f4a15a49'`

### Step 3: Check UI

1. Navigate to: `http://localhost:5173/requests`
2. Open the test request
3. Verify the quote appears with:
   - Amount: ₦50,000
   - Status: Quoted (with Accept/Reject buttons)
   - Creator: wickhed7

---

## Part 4: Common Issues & Solutions

### Issue 1: `dobble_tap_request_id` is NULL

**Problem**: Dobbletap's webhook response doesn't include the ID.

**Solution**: Dobbletap must return `{ "id": "YOUR_UUID" }` in the response.

### Issue 2: Callback Returns 404 (Request Not Found)

**Problem**: ID mapping failed.

**Check**:
```sql
-- Check if the mapping exists
SELECT id, dobble_tap_request_id
FROM creator_requests
WHERE id = 'TEST_REQUEST_ID'
   OR dobble_tap_request_id = 'DOBBLETAP_REQUEST_ID';
```

**Solution**: Ensure Dobbletap sends the correct `request_id` in the callback.

### Issue 3: creator_request_items Not Updated

**Problem**: Creator ID mapping failed.

**Check**:
```sql
-- Verify creator mapping exists
SELECT id, dobble_tap_user_id
FROM creators
WHERE dobble_tap_user_id = '29f99241-53d1-4f78-b9b0-2169f4a15a49';
```

**Solution**: Ensure the creator exists in DTTracker with `dobble_tap_user_id` populated.

### Issue 4: Status is 'pending' Instead of 'quoted'

**Problem**: Status mapping issue.

**Check Callback Logs**: Look for "Mapped Dobbletap creator to DTTracker creator" in function logs.

**Solution**: Verify the callback payload has `status: "accepted"` (not `status: "pending"`).

---

## Part 5: Callback Testing Tool

### Manual Test from Command Line

```bash
# Replace these variables:
# - TEST_REQUEST_ID: DTTracker's request ID
# - DOBBLETAP_REQUEST_ID: Dobbletap's request ID

curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c" \
  -d '{
    "request_id": "DOBBLETAP_REQUEST_ID",
    "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
    "status": "accepted",
    "quoted_amount": 50000,
    "response_message": "Test quote for integration",
    "responded_at": "2026-02-08T15:30:00Z"
  }'
```

**Expected Response (Success)**:
```json
{
  "success": true,
  "message": "Quote received successfully",
  "request_id": "TEST_REQUEST_ID",
  "quote_status": "pending"
}
```

**Expected Response (Error - Request Not Found)**:
```json
{
  "error": "Creator request not found",
  "request_id": "DOBBLETAP_REQUEST_ID"
}
```

---

## Part 6: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Brand Creates Request on DTTracker                     │
├─────────────────────────────────────────────────────────────────┤
│ DTTracker:                                                      │
│ - Creates request: TEST_REQUEST_ID                             │
│ - Creates creator_request_items row                            │
│ - Status: pending                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: DTTracker Syncs to Dobbletap                          │
├─────────────────────────────────────────────────────────────────┤
│ POST /webhooks/dttracker                                        │
│ { eventType: "creator_request_created", data: {...} }         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Dobbletap Creates Request                              │
├─────────────────────────────────────────────────────────────────┤
│ Dobbletap:                                                      │
│ - Creates request: DOBBLETAP_REQUEST_ID                        │
│ - Stores DTTracker's TEST_REQUEST_ID                           │
│ - Maps creators: DT_CREATOR_ID ↔ DTT_CREATOR_ID               │
│ - Returns: { "id": "DOBBLETAP_REQUEST_ID" }                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: DTTracker Stores Mapping                               │
├─────────────────────────────────────────────────────────────────┤
│ UPDATE creator_requests SET:                                    │
│ - dobble_tap_request_id = DOBBLETAP_REQUEST_ID                 │
│ - synced_to_dobble_tap = true                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Creator Quotes on Dobbletap                            │
├─────────────────────────────────────────────────────────────────┤
│ Dobbletap:                                                      │
│ - Creator submits quote: ₦50,000                               │
│ - Status: accepted                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Dobbletap Sends Callback to DTTracker                  │
├─────────────────────────────────────────────────────────────────┤
│ POST /creator-quote-callback                                    │
│ {                                                               │
│   request_id: DOBBLETAP_REQUEST_ID,                            │
│   creator_id: DT_CREATOR_ID,                                   │
│   quoted_amount: 50000,                                         │
│   status: "accepted"                                            │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 7: DTTracker Maps IDs                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Lookup request by dobble_tap_request_id                     │
│    → Finds TEST_REQUEST_ID                                     │
│ 2. Lookup creator by dobble_tap_user_id                        │
│    → Finds DTT_CREATOR_ID                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 8: DTTracker Updates Database                             │
├─────────────────────────────────────────────────────────────────┤
│ UPDATE creator_requests:                                        │
│ - quote_received = true                                         │
│ - quoted_amount = 50000                                         │
│ - quote_status = 'pending'                                      │
│                                                                 │
│ UPSERT creator_request_items:                                   │
│ - request_id = TEST_REQUEST_ID                                 │
│ - creator_id = DTT_CREATOR_ID                                  │
│ - quoted_amount_cents = 50000                                   │
│ - status = 'quoted'                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 9: Brand Sees Quote in UI                                 │
├─────────────────────────────────────────────────────────────────┤
│ DTTracker UI:                                                   │
│ - Quote amount: ₦50,000                                        │
│ - Status: Quoted                                                │
│ - Actions: Accept / Reject buttons                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Checklist for Dobbletap Team

- [ ] Verify webhook endpoint receives `creator_request_created` events
- [ ] Store DTTracker's `request_id` from webhook payload
- [ ] Return `{ "id": "YOUR_UUID" }` in webhook response
- [ ] Map Dobbletap creator IDs to DTTracker creator IDs
- [ ] When creator quotes, send callback to DTTracker
- [ ] Callback includes correct `request_id` (Dobbletap's ID is OK, will be mapped)
- [ ] Callback includes correct `creator_id` (Dobbletap's ID is OK, will be mapped)
- [ ] Callback includes `quoted_amount` in kobo (not naira)
- [ ] Callback includes `status: "accepted"` for accepted quotes
- [ ] Test with the provided curl command

---

## Part 8: Success Criteria

✅ **Integration is working if**:
1. DTTracker can sync requests to Dobbletap
2. `dobble_tap_request_id` is populated in DTTracker
3. Creator quotes appear in Dobbletap
4. Quote callbacks reach DTTracker
5. `creator_request_items` is updated with quote data
6. Quote appears in DTTracker UI with Accept/Reject buttons

---

## Contact

**DTTracker Side**: If you encounter issues, check:
- Supabase function logs: `https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions`
- Database queries provided in Part 3

**Dobbletap Side**: If you encounter issues:
- Verify the webhook endpoint is receiving events
- Check the callback response status
- Ensure ID mappings are stored correctly

---

## Part 9: Real-World Test Case (ACTUAL DATA)

### Test Executed: February 8, 2026

This is a REAL test that was executed showing the exact point where the integration is failing.

### Step 1: Request Created on DTTracker ✅

**DTTracker Request ID**: `067f722d-fc5f-4402-9c48-e830e6192599`

**Database State (creator_requests)**:
```json
{
  "id": "067f722d-fc5f-4402-9c48-e830e6192599",
  "user_id": "dd2c4c89-fd6e-4c17-b3b2-d81a7bf97bd3",
  "campaign_type": "brand_promotion",
  "campaign_brief": "Promote our new product launch",
  "deliverables": ["instagram_reel", "tiktok_post"],
  "posts_per_creator": 2,
  "usage_rights": "repost_brand_pages",
  "deadline": "2026-02-15T00:00:00Z",
  "urgency": "normal",
  "contact_person_name": "Brand Manager",
  "contact_person_email": "brand@example.com",
  "status": "submitted",
  "synced_to_dobble_tap": true,
  "dobble_tap_request_id": "a39b0a99-d3fa-43da-ac68-24aab3e78395"
}
```

**Key Facts**:
- ✅ Request created successfully
- ✅ `synced_to_dobble_tap`: `true`
- ✅ `dobble_tap_request_id`: `a39b0a99-d3fa-43da-ac68-24aab3e78395`

**Creator Invited**: wickhed7 (`0be6f5e4-208e-4338-8655-8aa6973990b7`)

---

### Step 2: Request Synced to Dobbletap ✅

**Dobbletap Request ID**: `a39b0a99-d3fa-43da-ac68-24aab3e78395`

DTTracker sent webhook to Dobbletap with payload:
```json
{
  "eventType": "creator_request_created",
  "timestamp": "2026-02-08T...",
  "data": {
    "request_id": "067f722d-fc5f-4402-9c48-e830e6192599",
    "creator_ids": ["29f99241-53d1-4f78-b9b0-2169f4a15a49"],
    "dttracker_creator_ids": ["0be6f5e4-208e-4338-8655-8aa6973990b7"],
    ...
  }
}
```

Dobbletap successfully:
- ✅ Created request with ID: `a39b0a99-d3fa-43da-ac68-24aab3e78395`
- ✅ Showed request to creator wickhed7

---

### Step 3: Creator Quoted on Dobbletap ✅

**What Happened on Dobbletap**:
- Creator wickhed7 submitted a quote
- **Quoted Amount**: ₦30,000 (30000)
- **Status**: accepted

**Expected Dobbletap Callback**:
```json
{
  "request_id": "a39b0a99-d3fa-43da-ac68-24aab3e78395",
  "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
  "status": "accepted",
  "quoted_amount": 30000,
  "response_message": "...",
  "responded_at": "2026-02-08T..."
}
```

---

### Step 4: DTTracker Database State AFTER Quote ❌

**Database Query**:
```sql
SELECT
  cri.id,
  cri.status,
  cri.quoted_amount_cents,
  cri.quoted_currency,
  cri.quoted_at,
  cri.quote_notes,
  c.name,
  c.dobble_tap_user_id
FROM creator_request_items cri
JOIN creators c ON c.id = cri.creator_id
WHERE cri.request_id = '067f722d-fc5f-4402-9c48-e830e6192599';
```

**ACTUAL Result**:
```json
{
  "id": "some-uuid",
  "status": "pending",
  "quoted_amount_cents": null,
  "quoted_currency": null,
  "quoted_at": null,
  "quote_notes": null,
  "name": "wickhed7",
  "dobble_tap_user_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49"
}
```

**EXPECTED Result**:
```json
{
  "id": "some-uuid",
  "status": "quoted",
  "quoted_amount_cents": 30000,
  "quoted_currency": "NGN",
  "quoted_at": "2026-02-08T...",
  "quote_notes": "...",
  "name": "wickhed7",
  "dobble_tap_user_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49"
}
```

---

### Diagnosis: Callback NOT Received ❌

**Evidence**: All quote-related fields are `null` in `creator_request_items` table.

**This means**:
1. ❌ Dobbletap did NOT send the quote callback to DTTracker
2. ❌ OR the callback failed authentication (401 Unauthorized)
3. ❌ OR the callback was sent to the wrong URL

**For Dobbletap Team**: Please verify:
- [ ] Was a callback sent when the creator quoted ₦30,000?
- [ ] What URL was the callback sent to?
- [ ] What authentication header was used?
- [ ] What was the response status code?

---

### Action Required: Dobbletap Team

**Test the Callback Manually** with this exact data:

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_SYNC_API_KEY>" \
  -d '{
    "request_id": "a39b0a99-d3fa-43da-ac68-24aab3e78395",
    "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
    "status": "accepted",
    "quoted_amount": 30000,
    "response_message": "I can deliver this campaign",
    "responded_at": "2026-02-08T15:00:00Z"
  }'
```

**CRITICAL**: Replace `<YOUR_SYNC_API_KEY>` with your actual SYNC_API_KEY.

**Expected Response (200 OK)**:
```json
{
  "success": true,
  "message": "Quote received successfully",
  "request_id": "067f722d-fc5f-4402-9c48-e830e6192599",
  "quote_status": "pending"
}
```

**After successful callback, verify DTTracker database**:
```sql
SELECT
  cri.status,
  cri.quoted_amount_cents,
  cri.quoted_currency,
  cri.quoted_at
FROM creator_request_items cri
WHERE cri.request_id = '067f722d-fc5f-4402-9c48-e830e6192599';
```

**Should now show**:
- `status`: `'quoted'` ✅
- `quoted_amount_cents`: `30000` ✅
- `quoted_currency`: `'NGN'` ✅
- `quoted_at`: `'2026-02-08T15:00:00Z'` ✅

---

### Summary of Real-World Test

| Step | Status | Details |
|------|--------|---------|
| 1. DTTracker creates request | ✅ | ID: `067f722d-fc5f-4402-9c48-e830e6192599` |
| 2. Sync to Dobbletap | ✅ | Dobbletap ID: `a39b0a99-d3fa-43da-ac68-24aab3e78395` |
| 3. Creator quotes on Dobbletap | ✅ | Amount: ₦30,000 |
| 4. Dobbletap sends callback | ❌ | **NOT RECEIVED** |
| 5. DTTracker updates database | ❌ | Still showing `null` values |
| 6. Quote appears in UI | ❌ | Cannot display without data |

**Conclusion**: The integration works up to Step 3. The failure is in Step 4 - Dobbletap is not sending the callback to DTTracker (or authentication is failing).

---

**Last Updated**: February 8, 2026
**Document Version**: 1.1
**Status**: Ready for Testing - Real test data added
