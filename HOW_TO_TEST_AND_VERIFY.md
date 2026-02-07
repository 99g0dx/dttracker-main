# How to Test and Verify the Integration

Complete guide for testing and verifying the DTTracker ↔ Dobbletap integration.

---

## Quick Start: Run Automated Tests

### 1. Run the Complete E2E Test Suite

```bash
cd /Users/admin/Downloads/dttracker-main
./test-e2e-integration.sh
```

**Expected Output:**
```
✅ ALL TESTS PASSED - INTEGRATION 100% WORKING! 🎉
Total Tests: 9
Passed: 9
Failed: 0
```

### 2. Run Individual Test Scripts

**Test DTTracker → Dobbletap (Outbound):**
```bash
./test-outbound-webhooks.sh
```

**Test Dobbletap → DTTracker (Inbound):**
```bash
./test-webhooks.sh
```

**Test Public Campaign Creation:**
```bash
./test-public-activation-sync.sh
```

**Test Targeted Campaign:**
```bash
./test-targeted-campaign.sh
```

---

## Manual Testing

### Test 1: Create a Campaign in Dobbletap

```bash
# Set your variables
SYNC_API_KEY="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"
CAMPAIGN_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Send webhook
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"activation_created\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"id\": \"$CAMPAIGN_ID\",
      \"title\": \"My Test Campaign\",
      \"brand\": \"My Brand\",
      \"campaignType\": \"contest\",
      \"brief\": \"Test campaign\",
      \"budget\": 100000,
      \"platforms\": [\"tiktok\"],
      \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }
  }"
```

**Expected Response:**
```json
{
  "status": "ok",
  "campaignId": "some-dobbletap-uuid"
}
```

### Test 2: Send Submission Webhook to DTTracker

```bash
# Send submission
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"submission_created\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"creatorCampaignId\": \"$CAMPAIGN_ID\",
      \"assetId\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"assetUrl\": \"https://example.com/video.mp4\",
      \"version\": 1,
      \"submittedBy\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"submittedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }
  }"
```

**Expected Response (if activation doesn't exist):**
```json
{
  "error": "Activation not found",
  "event_id": "webhook-event-uuid",
  "status": "activation_not_found"
}
```

### Test 3: Test Idempotency (Send Same Webhook Twice)

```bash
# Save timestamp
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# First call
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"submission_created\",
    \"timestamp\": \"$TS\",
    \"data\": {
      \"creatorCampaignId\": \"test-id\",
      \"assetId\": \"test-asset\",
      \"assetUrl\": \"https://example.com/video.mp4\",
      \"version\": 1,
      \"submittedBy\": \"test-user\",
      \"submittedAt\": \"$TS\"
    }
  }"

# Second call (duplicate - should return already_processed)
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"submission_created\",
    \"timestamp\": \"$TS\",
    \"data\": {
      \"creatorCampaignId\": \"test-id\",
      \"assetId\": \"test-asset\",
      \"assetUrl\": \"https://example.com/video.mp4\",
      \"version\": 1,
      \"submittedBy\": \"test-user\",
      \"submittedAt\": \"$TS\"
    }
  }"
```

**Expected Second Response:**
```json
{
  "id": "webhook-event-uuid",
  "status": "already_processed",
  "processed_at": "2026-02-07T18:00:00Z"
}
```

---

## Verify in Database

### 1. Check Dobbletap Campaign Was Created

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp
2. Click **Table Editor**
3. Open **campaigns** table
4. Filter: `source = 'dttracker'`
5. Look for your test campaigns

**Via SQL:**
```sql
-- Check campaigns from DTTracker
SELECT
  campaign_id,
  title,
  brand,
  source,
  source_campaign_id,
  budget,
  created_at
FROM campaigns
WHERE source = 'dttracker'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Check DTTracker Webhook Events

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy
2. Click **Table Editor**
3. Open **webhook_events** table
4. See all received webhooks from Dobbletap

**Via SQL:**
```sql
-- Check webhook events
SELECT
  event_type,
  campaign_id,
  timestamp,
  processed_at,
  idempotency_key
FROM webhook_events
ORDER BY processed_at DESC
LIMIT 10;
```

### 3. Check Submissions in DTTracker

```sql
-- Check submissions
SELECT
  id,
  activation_id,
  dobble_tap_submission_id,
  asset_url,
  status,
  submitted_at,
  synced_to_dobble_tap
FROM activation_submissions
WHERE dobble_tap_submission_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## Check Function Logs

### DTTracker Function Logs

1. Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/logs/edge-functions
2. Select function: `dobbletap-webhook-submission` (or any other)
3. View recent logs
4. Look for:
   - ✅ Success messages
   - ⚠️ Warnings (e.g., "Activation not found")
   - ❌ Errors

### Dobbletap Function Logs

1. Go to: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp/logs/edge-functions
2. Select function: `make-server-8061e72e`
3. View recent logs

---

## Test Error Handling

### Test 1: Missing Authentication

```bash
# Send request without auth token
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Expected:**
```json
{
  "error": "Unauthorized"
}
```
HTTP Status: 401

### Test 2: Invalid Data

```bash
# Send request with missing required fields
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "submission_created"
  }'
```

**Expected:**
```json
{
  "error": "Missing required fields",
  "required": ["eventType", "timestamp", "data"]
}
```
HTTP Status: 400

### Test 3: Non-Existent Activation

```bash
# Send submission for non-existent activation
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"submission_created\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"creatorCampaignId\": \"00000000-0000-0000-0000-000000000000\",
      \"assetId\": \"test-asset\",
      \"assetUrl\": \"https://example.com/video.mp4\",
      \"version\": 1,
      \"submittedBy\": \"$(uuidgen | tr '[:upper:]' '[:lower:]')\",
      \"submittedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }
  }"
```

**Expected:**
```json
{
  "error": "Activation not found",
  "event_id": "webhook-event-uuid",
  "status": "activation_not_found"
}
```
HTTP Status: 404

---

## Test All 6 DTTracker Webhook Endpoints

### 1. Submission Webhook ✅

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{...}"
```

### 2. Status Change Webhook ✅

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-status-change" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"status_changed\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"creatorCampaignId\": \"test-id\",
      \"oldStatus\": \"pending\",
      \"newStatus\": \"accepted\"
    }
  }"
```

### 3. Review Decision Webhook ✅

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-review-decision" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"review_decision\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"assetId\": \"test-asset\",
      \"decision\": \"approved\",
      \"feedback\": \"Great work!\"
    }
  }"
```

### 4. Post Submitted Webhook ✅

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-post-submitted" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"post_submitted\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"creatorCampaignId\": \"test-id\",
      \"postUrl\": \"https://tiktok.com/@user/video/123\",
      \"platform\": \"tiktok\"
    }
  }"
```

### 5. Campaign Completed Webhook ✅

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-campaign-completed" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"campaign_completed\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"creatorCampaignId\": \"test-id\",
      \"status\": \"completed\",
      \"paymentAmount\": 50000,
      \"paymentCurrency\": \"NGN\",
      \"paymentReference\": \"PYSK_123\"
    }
  }"
```

### 6. Verification Completed Webhook ✅

```bash
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-verification-completed" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"verification_completed\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"submissionId\": \"test-submission-id\",
      \"verificationType\": \"sm_panel\",
      \"verificationStatus\": \"verified\",
      \"verificationResults\": {
        \"likes\": 1000,
        \"shares\": 50
      }
    }
  }"
```

---

## Monitoring & Health Checks

### Check Function Status

```bash
# Check if functions are deployed
npx supabase functions list

# Expected output should show:
# - dobbletap-webhook-submission
# - dobbletap-webhook-status-change
# - dobbletap-webhook-review-decision
# - dobbletap-webhook-post-submitted
# - dobbletap-webhook-campaign-completed
# - dobbletap-webhook-verification-completed
```

### Check Environment Variables

```bash
# List Supabase secrets
npx supabase secrets list

# Should show:
# SYNC_API_KEY = ...
# DOBBLE_TAP_API = ...
# CRON_SECRET = ...
```

---

## Troubleshooting

### Issue: Getting 401 Unauthorized

**Problem**: Wrong or missing API key

**Solution**:
```bash
# Verify you're using the correct key
SYNC_API_KEY="617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655"

# Make sure to include "Bearer " prefix
curl -H "Authorization: Bearer ${SYNC_API_KEY}" ...
```

### Issue: Getting 404 Not Found

**Problem**: Endpoint doesn't exist or function not deployed

**Solution**:
```bash
# Redeploy the function
npx supabase functions deploy dobbletap-webhook-submission

# Check deployment
npx supabase functions list
```

### Issue: Getting 500 Internal Server Error

**Problem**: Code error or database issue

**Solution**:
1. Check function logs in Supabase dashboard
2. Look for error messages
3. Verify database schema is correct
4. Check foreign key constraints

### Issue: Webhook Says "Activation not found"

**Problem**: Activation doesn't exist in DTTracker database

**Solution**: This is expected! Create the activation first:
```bash
# First create activation in Dobbletap
curl -X POST \
  "https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker" \
  -H "Authorization: Bearer ${SYNC_API_KEY}" \
  -d '{...activation data...}'

# Then send submission webhook
curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
  -d '{...submission data...}'
```

---

## Quick Reference

### Endpoints

**DTTracker (Receiving from Dobbletap)**:
```
Base: https://ucbueapoexnxhttynfzy.supabase.co/functions/v1
Auth: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655

/dobbletap-webhook-submission
/dobbletap-webhook-status-change
/dobbletap-webhook-review-decision
/dobbletap-webhook-post-submitted
/dobbletap-webhook-campaign-completed
/dobbletap-webhook-verification-completed
```

**Dobbletap (Receiving from DTTracker)**:
```
Base: https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e
Auth: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655

/webhooks/dttracker
```

### Test Scripts

```bash
# Complete E2E test (9 tests)
./test-e2e-integration.sh

# DTTracker inbound webhooks (6 tests)
./test-webhooks.sh

# DTTracker outbound webhooks (4 tests)
./test-outbound-webhooks.sh

# Public campaign creation
./test-public-activation-sync.sh

# Targeted campaign test
./test-targeted-campaign.sh
```

### Dashboards

**DTTracker Supabase**:
- Project: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy
- Functions: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
- Logs: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/logs/edge-functions
- Tables: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/editor

**Dobbletap Supabase**:
- Project: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp
- Functions: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp/functions
- Logs: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp/logs/edge-functions
- Tables: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp/editor

---

## Success Criteria

✅ **Integration is working if:**
1. E2E test shows 9/9 passed
2. Campaigns created in Dobbletap appear with `source='dttracker'`
3. Webhooks to DTTracker return proper 200 or 404 responses (not 500)
4. Idempotency works (duplicate webhooks return "already_processed")
5. Webhook events are logged in `webhook_events` table
6. Function logs show no errors

🚀 **You're ready for production!**
