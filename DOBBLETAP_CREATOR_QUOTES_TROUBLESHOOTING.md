# Dobbletap → DTTracker Creator Quotes: Troubleshooting Guide

**Date**: February 8, 2026  
**Status**: Creator request sync ✅ working, Creator quote reflection ❌ not visible

---

## Summary

Creator requests from DTTracker are now syncing into Dobbletap correctly.  
However, **creator quotes sent back from Dobbletap are not being reflected in DTTracker**.

This document explains the expected flow, exact endpoint + payload, and what to check on the Dobbletap side.

---

## ✅ Working (DTTracker → Dobbletap)

DTTracker is successfully calling the Dobbletap webhook:

**Event type**: `creator_request_created`  
**Payload includes**:
- `request_id` (DTTracker request UUID)
- `creator_ids` **as Dobbletap user IDs**
- campaign details (type, brief, deliverables, deadline, etc.)

Logs confirm:
```
Creator request synced to Dobbletap successfully
```

---

## ❌ Not Working (Dobbletap → DTTracker)

Creators can quote in Dobbletap, but the quote **does not show in DTTracker UI**.

This means the callback **is not being received** or **does not update the DTTracker DB**.

---

## Expected Callback (Dobbletap → DTTracker)

**Endpoint**  
`POST https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback`

**Auth**  
`Authorization: Bearer <SYNC_API_KEY>`

**Payload**
```json
{
  "request_id": "dttracker-request-uuid",
  "creator_id": "dttracker-creator-uuid",
  "dobble_tap_creator_id": "dobbletap-creator-uuid",
  "status": "accepted",
  "quoted_amount": 75000,
  "response_message": "I can deliver this by the deadline",
  "responded_at": "2026-02-08T14:30:00Z"
}
```

**Expected Response**
```json
{
  "success": true,
  "message": "Quote received successfully",
  "request_id": "uuid",
  "quote_status": "pending"
}
```

---

## What DTTracker Updates on Success

In `creator_requests`:
- `quote_received = true`
- `quoted_amount = <value>`
- `creator_response_message = <value>`
- `quote_status = 'pending' | 'accepted' | 'declined'`
- `quote_received_at = responded_at`

In `creator_request_items` (per creator):
- `quoted_amount_cents`
- `quoted_currency`
- `quote_notes`
- `quoted_by`
- `quoted_at`
- `status = 'quoted'` (if implemented)

---

## Quick Verification Queries (DTTracker)

**Check the request**
```sql
select id, quote_received, quoted_amount, quote_status, creator_response_message
from creator_requests
where id = 'YOUR_REQUEST_ID';
```

**Check the per-creator item**
```sql
select id, request_id, creator_id, quoted_amount_cents, quoted_currency, quote_notes, quoted_at
from creator_request_items
where request_id = 'YOUR_REQUEST_ID';
```

---

## Common Failure Points to Check on Dobbletap

### 1) Wrong `request_id`
Must be DTTracker **creator_requests.id** (UUID), not campaign ID.

### 2) Missing/Invalid Authorization
Header must be:
```
Authorization: Bearer <SYNC_API_KEY>
```
If missing/invalid → DTTracker returns 401 and nothing updates.

### 3) Missing required fields
If `quoted_amount` is missing when `status = "accepted"`, DTTracker rejects.

### 4) Creator mapping mismatch
`creator_id` should be DTTracker’s creator UUID  
`dobble_tap_creator_id` should be Dobbletap creator UUID  
If these are swapped, DTTracker may not match the creator request item.

### 5) Callback never sent
Confirm Dobbletap backend actually sends the request when creator submits a quote.

---

## Troubleshooting Steps for Dobbletap

1. **Log the outbound payload** sent to DTTracker when a creator quotes.
2. **Confirm HTTP 200 response** from DTTracker.
3. If 4xx/5xx:
   - Capture response body.
   - Fix payload or auth and retry.
4. If 200 but no update:
   - Run the DTTracker SQL checks above.
   - Verify IDs are correct (request_id + creator_id).

---

## Example cURL (for Dobbletap team)

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback" \
  -H "Authorization: Bearer <SYNC_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "YOUR_DTTRACKER_REQUEST_ID",
    "creator_id": "YOUR_DTTRACKER_CREATOR_ID",
    "dobble_tap_creator_id": "YOUR_DOBBLETAP_CREATOR_ID",
    "status": "accepted",
    "quoted_amount": 75000,
    "response_message": "I can deliver this by the deadline",
    "responded_at": "2026-02-08T14:30:00Z"
  }'
```

---

## Contacts / Notes

If Dobbletap needs new fields or a different format, send the full payload and DTTracker team will adapt.  
This issue is currently **blocking quote visibility in DTTracker**, so priority is on getting the callback working and verified. 
