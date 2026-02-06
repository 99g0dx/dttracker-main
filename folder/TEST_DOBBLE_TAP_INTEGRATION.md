# Testing & Troubleshooting DTTracker ↔ Dobble Tap Integration

This guide helps you test and troubleshoot the integration between DTTracker and Dobble Tap.

---

## 🔍 Pre-Testing Checklist

Before testing, verify these are configured:

### DTTracker Secrets (Supabase)
- ✅ `DOBBLE_TAP_API` - Set to Dobble Tap's webhook URL
- ✅ `SYNC_API_KEY` - Set (shared secret)
- ✅ `SUPABASE_URL` - Set
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Set

### Dobble Tap Configuration
- ✅ `DTTRACKER_API_URL` - Set to: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1`
- ✅ `DTTRACKER_API_KEY` - Set (must match `SYNC_API_KEY`)

### Deploy Edge Functions First (Required)
The integration endpoints are Supabase Edge Functions. They must be **deployed** to your project before tests or Dobble Tap can call them. If you get **404 "Requested function was not found"**, deploy with:

```bash
# From the project root, with Supabase CLI linked to your project
supabase link --project-ref ucbueapoexnxhttynfzy   # if not already linked
supabase functions deploy creator-sync-from-dobbletap
supabase functions deploy creator-stats-sync-from-dobbletap
supabase functions deploy activation-submission-webhook
```

Then run the test script again.

---

## 🧪 Test 1: Verify Secrets Are Set

### Check DTTracker Secrets

```bash
supabase secrets list | grep -E "DOBBLE_TAP_API|SYNC_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"
```

**Expected Output:**
```
DOBBLE_TAP_API            | <digest>
SYNC_API_KEY              | <digest>
SUPABASE_URL              | <digest>
SUPABASE_SERVICE_ROLE_KEY | <digest>
```

**If missing:** Set them using:
```bash
supabase secrets set SYNC_API_KEY=your-key-here
supabase secrets set DOBBLE_TAP_API=https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e
```

---

## 🧪 Test 2: Test Dobble Tap → DTTracker (Creator Sync)

This tests if Dobble Tap can sync creators to DTTracker.

### Test Command

```bash
# Replace YOUR_SYNC_API_KEY with the actual SYNC_API_KEY value
curl -X POST \
  'https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap' \
  -H "Authorization: Bearer YOUR_SYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "creator_id": "test-creator-123",
    "profile_photo": "https://example.com/photo.jpg",
    "bio": "Test creator bio",
    "location": "Lagos, Nigeria",
    "social_accounts": [
      {
        "platform": "tiktok",
        "handle": "@testcreator",
        "followers": 10000,
        "verified_at": "2024-01-01T00:00:00Z"
      }
    ]
  }'
```

### Expected Success Response

```json
{
  "success": true,
  "creator_id": "uuid-of-created-creator"
}
```

### Verify in Database

Check if creator was created:
```sql
SELECT id, name, handle, platform, dobble_tap_user_id, follower_count 
FROM creators 
WHERE dobble_tap_user_id = 'test-creator-123';
```

---

## 🧪 Test 3: Test Dobble Tap → DTTracker (Creator Stats Sync)

This tests if Dobble Tap can update creator statistics.

### Prerequisites
- A creator must exist in DTTracker (use Test 2 first)

### Test Command

```bash
# Replace YOUR_SYNC_API_KEY and CREATOR_UUID with actual values
curl -X POST \
  'https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-stats-sync-from-dobbletap' \
  -H "Authorization: Bearer YOUR_SYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "creator_id": "CREATOR_UUID_FROM_TEST_2",
    "activation_id": "some-activation-uuid",
    "views": 50000,
    "likes": 5000,
    "comments": 500,
    "shares": 200,
    "engagement_rate": 0.114
  }'
```

### Expected Success Response

```json
{
  "success": true
}
```

### Verify in Database

```sql
SELECT creator_id, campaigns_completed, total_reach, avg_engagement_rate, avg_views_per_post
FROM creator_stats
WHERE creator_id = 'CREATOR_UUID_FROM_TEST_2';
```

---

## 🧪 Test 4: Test Dobble Tap → DTTracker (Activation Submission)

This tests if Dobble Tap can submit activation submissions.

### Prerequisites
- An activation must exist in DTTracker (create one via UI or API)

### Test Command

```bash
# Replace YOUR_SYNC_API_KEY, ACTIVATION_UUID, and CREATOR_UUID with actual values
curl -X POST \
  'https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/activation-submission-webhook' \
  -H "Authorization: Bearer YOUR_SYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activation_id": "ACTIVATION_UUID",
    "creator_id": "CREATOR_UUID",
    "creator_handle": "@testcreator",
    "creator_platform": "tiktok",
    "content_url": "https://tiktok.com/@testcreator/video/123",
    "proof_url": "https://example.com/proof.jpg",
    "proof_comment_text": "Test comment",
    "submitted_at": "2024-01-01T12:00:00Z",
    "payment_amount": 5000,
    "tier": "A",
    "creator_followers": 10000,
    "verification_method": "manual"
  }'
```

### Expected Success Response

```json
{
  "success": true,
  "submission_id": "submission-uuid",
  "status": "pending"
}
```

---

## 🧪 Test 5: Test DTTracker → Dobble Tap (Webhook)

This tests if DTTracker can send webhooks to Dobble Tap.

### Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → Logs
2. Trigger an action that should sync to Dobble Tap (e.g., create an activation)
3. Check logs for webhook calls

### Manual Test (if you have access to Dobble Tap logs)

Create an activation in DTTracker and check if Dobble Tap receives the webhook.

---

## 📊 Monitoring & Logs

### View DTTracker Edge Function Logs

1. **Supabase Dashboard:**
   - Go to: https://app.supabase.com
   - Select project: `ucbueapoexnxhttynfzy`
   - Navigate to: **Edge Functions** → Select function → **Logs**

2. **Functions to Monitor:**
   - `creator-sync-from-dobbletap`
   - `creator-stats-sync-from-dobbletap`
   - `activation-submission-webhook`

### Check Sync Queue (if webhooks fail)

```sql
SELECT 
  id,
  sync_type,
  entity_id,
  status,
  retry_count,
  error_message,
  created_at,
  retry_after
FROM dobble_tap_sync_queue
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🐛 Common Errors & Solutions

### Error: "Unauthorized" (401)

**Symptoms:**
```json
{
  "error": "Unauthorized"
}
```

**Causes:**
- Missing `Authorization` header
- Wrong API key
- `SYNC_API_KEY` not set in Supabase

**Solutions:**
1. Verify `SYNC_API_KEY` is set:
   ```bash
   supabase secrets list | grep SYNC_API_KEY
   ```

2. Verify the Authorization header format:
   ```
   Authorization: Bearer YOUR_SYNC_API_KEY
   ```

3. Ensure Dobble Tap uses the same key as `SYNC_API_KEY`

---

### Error: "Server configuration error" (500)

**Symptoms:**
```json
{
  "error": "Server configuration error"
}
```

**Causes:**
- Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`

**Solutions:**
1. Check secrets:
   ```bash
   supabase secrets list | grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"
   ```

2. Set missing secrets:
   ```bash
   # Get these from Supabase Dashboard → Settings → API
   supabase secrets set SUPABASE_URL=https://ucbueapoexnxhttynfzy.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

---

### Error: "creator_id required" (400)

**Symptoms:**
```json
{
  "error": "creator_id required"
}
```

**Causes:**
- Missing `creator_id` in request body

**Solutions:**
- Ensure request includes `creator_id` field
- For creator sync, use `creator_id` (Dobble Tap's user ID)
- For stats sync, use DTTracker's creator UUID

---

### Error: "Requested function was not found" (404)

**Symptoms:**
```json
{
  "code": "NOT_FOUND",
  "message": "Requested function was not found"
}
```

**Causes:**
- Edge Functions are not deployed to the Supabase project.

**Solutions:**
1. Deploy the integration functions (see **Deploy Edge Functions First** in the Pre-Testing Checklist):
   ```bash
   supabase functions deploy creator-sync-from-dobbletap
   supabase functions deploy creator-stats-sync-from-dobbletap
   supabase functions deploy activation-submission-webhook
   ```
2. Ensure the project is linked: `supabase link --project-ref ucbueapoexnxhttynfzy`
3. Run the test script again.

---

### Error: "Activation not found" (404)

**Symptoms:**
```json
{
  "error": "Activation not found"
}
```

**Causes:**
- Invalid `activation_id`
- Activation doesn't exist in DTTracker

**Solutions:**
1. Verify activation exists:
   ```sql
   SELECT id, title, status FROM activations WHERE id = 'ACTIVATION_UUID';
   ```

2. Use a valid activation UUID from DTTracker

---

### Error: "social_accounts array required" (400)

**Symptoms:**
```json
{
  "error": "social_accounts array required with at least one account"
}
```

**Causes:**
- Missing or empty `social_accounts` array in creator sync request

**Solutions:**
- Ensure request includes at least one social account:
   ```json
   {
     "social_accounts": [
       {
         "platform": "tiktok",
         "handle": "@username",
         "followers": 1000
       }
     ]
   }
   ```

---

### Webhooks Not Reaching Dobble Tap

**Symptoms:**
- DTTracker actions don't sync to Dobble Tap
- No errors in logs, but no webhooks received

**Solutions:**
1. Verify `DOBBLE_TAP_API` is set correctly:
   ```bash
   supabase secrets list | grep DOBBLE_TAP_API
   ```

2. Check sync queue for failed items:
   ```sql
   SELECT * FROM dobble_tap_sync_queue WHERE status = 'failed';
   ```

3. Verify Dobble Tap endpoint is accessible:
   ```bash
   curl -X POST https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/api/sync/activation \
     -H "Authorization: Bearer YOUR_SYNC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

---

## ✅ Verification Checklist

After testing, verify:

- [ ] Creator sync works (Dobble Tap → DTTracker)
- [ ] Creator stats sync works (Dobble Tap → DTTracker)
- [ ] Activation submission works (Dobble Tap → DTTracker)
- [ ] Webhooks send successfully (DTTracker → Dobble Tap)
- [ ] No errors in Edge Function logs
- [ ] Database records are created/updated correctly
- [ ] Authentication works (401 errors don't occur)

---

## 🔧 Debugging Tips

### 1. Enable Verbose Logging

Check Edge Function logs in real-time:
- Supabase Dashboard → Edge Functions → Select function → Logs
- Watch for errors, warnings, or unexpected responses

### 2. Test with Minimal Data

Start with the simplest possible request to isolate issues:
```json
{
  "creator_id": "test-123",
  "social_accounts": [{
    "platform": "tiktok",
    "handle": "@test",
    "followers": 1000
  }]
}
```

### 3. Verify Database State

Check what's actually in the database:
```sql
-- Check creators
SELECT * FROM creators WHERE dobble_tap_user_id = 'test-creator-123';

-- Check creator stats
SELECT * FROM creator_stats WHERE creator_id = 'CREATOR_UUID';

-- Check submissions
SELECT * FROM activation_submissions WHERE activation_id = 'ACTIVATION_UUID';
```

### 4. Test Authentication Separately

Test if authentication works:
```bash
# Should return 401 without auth
curl -X POST https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap

# Should return 400 (bad request) with auth but no body
curl -X POST https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap \
  -H "Authorization: Bearer YOUR_SYNC_API_KEY"
```

---

## 📞 Getting Help

If issues persist:

1. **Collect Information:**
   - Error messages from logs
   - Request/response examples
   - Database state (relevant records)
   - Secret configuration (digests, not values)

2. **Check:**
   - Supabase Edge Function logs
   - Database records
   - Network connectivity
   - Secret values (verify they're set correctly)

3. **Common Issues:**
   - Secrets not set → Set them
   - Wrong API key → Verify both sides use same key
   - Missing data → Check prerequisites
   - Network issues → Verify URLs are accessible

---

## 🎯 Quick Test Script

A ready-to-use test script is available at `scripts/test-dobble-tap-integration.sh`.

**Usage:**
```bash
# 1. Edit the script and set your SYNC_API_KEY
nano scripts/test-dobble-tap-integration.sh
# Or use your preferred editor to set: SYNC_API_KEY="your-key-here"

# 2. Make it executable (if not already)
chmod +x scripts/test-dobble-tap-integration.sh

# 3. Run the tests
./scripts/test-dobble-tap-integration.sh
```

**What it tests:**
- ✅ Creator sync (Dobble Tap → DTTracker)
- ✅ Creator stats sync (Dobble Tap → DTTracker)
- ✅ Shows pass/fail status for each test
- ✅ Displays HTTP status codes and error messages

---

**Last Updated:** $(date)
