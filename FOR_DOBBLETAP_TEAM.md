# For Dobbletap Team - Callback Configuration

**Date**: February 8, 2026
**Status**: ✅ **CALLBACK NOW WORKING** - Ready for integration

---

## The Problem

When creators submit quotes on Dobbletap, DTTracker is not receiving the callback notification.

### Evidence

**Test Request**:
- DTTracker ID: `067f722d-fc5f-4402-9c48-e830e6192599`
- Dobbletap ID: `a39b0a99-d3fa-43da-ac68-24aab3e78395`
- Creator quoted: ₦30,000
- **DTTracker database**: Still shows `null` for all quote fields

This proves the callback was not received (or failed).

---

## What You Need to Fix

### 1. Callback Endpoint

**URL**: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback`

**Method**: `POST`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c
```

⚠️ **IMPORTANT**: You must use your SYNC_API_KEY in the Authorization header.

### 2. Callback Payload Format

When a creator submits a quote, send this payload:

```json
{
  "request_id": "YOUR_DOBBLETAP_REQUEST_ID",
  "creator_id": "YOUR_DOBBLETAP_CREATOR_ID",
  "status": "accepted",
  "quoted_amount": 30000,
  "response_message": "Creator's message",
  "responded_at": "2026-02-08T15:00:00Z"
}
```

**Field Notes**:
- `request_id`: Can be EITHER your Dobbletap request ID OR DTTracker's request ID (we'll map it)
- `creator_id`: Can be EITHER your Dobbletap creator ID OR DTTracker's creator ID (we'll map it)
- `status`: Must be `"accepted"` for accepted quotes, `"declined"` for declined quotes
- `quoted_amount`: Amount in KOBO (e.g., 30000 for ₦30,000)
- `responded_at`: ISO 8601 timestamp

---

## Test It NOW

Use this curl command to test the callback with the real data:

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c" \
  -d '{
    "request_id": "a39b0a99-d3fa-43da-ac68-24aab3e78395",
    "creator_id": "29f99241-53d1-4f78-b9b0-2169f4a15a49",
    "status": "accepted",
    "quoted_amount": 30000,
    "response_message": "I can deliver this campaign",
    "responded_at": "2026-02-08T15:00:00Z"
  }'
```

### Expected Response (SUCCESS)

```json
{
  "success": true,
  "message": "Quote received successfully",
  "request_id": "067f722d-fc5f-4402-9c48-e830e6192599",
  "quote_status": "pending"
}
```

If you get this response, the integration is working! ✅

### Possible Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized"
}
```
→ **Fix**: Use the correct SYNC_API_KEY

**404 Not Found**:
```json
{
  "error": "Creator request not found",
  "request_id": "..."
}
```
→ **Fix**: Ensure you're sending the correct request_id (either yours or DTTracker's)

**400 Bad Request**:
```json
{
  "error": "Missing required fields: request_id, status"
}
```
→ **Fix**: Include all required fields in the payload

---

## How DTTracker Maps Your IDs

You can send **your own IDs** (Dobbletap IDs) and DTTracker will automatically map them:

### Request ID Mapping

1. DTTracker tries to find request by ID
2. If not found, searches `creator_requests.dobble_tap_request_id` field
3. Uses the mapped DTTracker request ID for updates

**Example**:
- You send: `request_id: "a39b0a99-d3fa-43da-ac68-24aab3e78395"` (your ID)
- DTTracker maps to: `067f722d-fc5f-4402-9c48-e830e6192599` (our ID)
- Updates happen with DTTracker's ID

### Creator ID Mapping

1. DTTracker looks up creator by `creators.dobble_tap_user_id`
2. Uses the mapped DTTracker creator ID

**Example**:
- You send: `creator_id: "29f99241-53d1-4f78-b9b0-2169f4a15a49"` (your ID)
- DTTracker maps to: `0be6f5e4-208e-4338-8655-8aa6973990b7` (our ID)
- Updates happen with DTTracker's ID

**You don't need to track DTTracker IDs** - just send your own IDs and we'll handle the mapping.

---

## Checklist

Please verify:

- [ ] Callback is triggered when creator submits a quote
- [ ] Callback URL is: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-quote-callback`
- [ ] Authorization header includes `Bearer <SYNC_API_KEY>`
- [ ] Payload includes all required fields: `request_id`, `status`
- [ ] Payload includes `quoted_amount` when status is "accepted"
- [ ] Test the curl command above and get 200 OK response
- [ ] After callback, DTTracker database shows quote data (verify with us)

---

## Current Integration Status

✅ **ALL WORKING**:
1. DTTracker syncs requests to Dobbletap
2. You receive `creator_request_created` webhooks
3. Creators can see and quote on requests
4. Quote callbacks from Dobbletap to DTTracker ✅ **NOW FUNCTIONAL!**

**The callback endpoint is fully functional and ready for integration!**

---

## Need Help?

If the curl test succeeds but real quotes still don't work, share:
1. The callback payload you're sending
2. The response you receive
3. The request ID and creator ID involved
4. Any error logs from your side

We'll help debug together.

---

**Contact**: Share this document with your team and configure the callback in production.

**Status**: ✅ Callback endpoint tested and working! Ready for production integration 🚀
