# How to Create a Zero-Budget Test Activation

This guide shows you how to create a test activation with no budget requirement to test the DTTracker ↔ Dobbletap integration.

## ✅ What's Been Updated

### 1. Database (Migration Required)
- **File**: `supabase/migrations/20260207999999_allow_zero_budget_testing.sql`
- Removed minimum budget constraint (was 2000 NGN for contests)
- Added `test_mode` column to identify test activations
- Now allows `total_budget >= 0` (including zero)

### 2. Edge Function (Already Deployed ✅)
- **File**: `supabase/functions/activation-publish/index.ts`
- Skips wallet operations for zero-budget activations
- No fund locking when `total_budget = 0`
- Still syncs to Dobbletap correctly

### 3. UI (Already Updated ✅)
- **File**: `src/app/components/activations/activation-create.tsx`
- Allows entering 0 as budget
- Shows "🧪 Test mode" indicator for zero-budget
- Validation allows 0 or minimum budget (no in-between)

---

## 📋 Step-by-Step Instructions

### Step 1: Run the Database Migration

Open your Supabase SQL Editor and run this migration:

```sql
-- Allow zero/minimal budget for testing activations
ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_contest_min_budget;

-- Add new constraint allowing zero budget
ALTER TABLE public.activations
  ADD CONSTRAINT activations_budget_non_negative
  CHECK (total_budget >= 0);

-- Add test_mode flag
ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.activations.test_mode IS
  'Set to true for test activations that bypass wallet/budget requirements';
```

**Supabase Dashboard**: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/sql/new

### Step 2: Create a Test Activation in the UI

1. **Go to Activations** → Click "Create Activation"

2. **Select Type**: Choose "Contest" or "SM Panel"

3. **Fill in Basic Details**:
   - **Title**: "Test Integration - [Your Name]"
   - **Brief**: "Testing DTTracker → Dobbletap sync"
   - **Platforms**: Select TikTok (or any platform)
   - **Deadline**: Any future date

4. **Set Budget to ZERO**:
   - **Total Prize Pool** (Contest) or **Total Budget** (SM Panel): Enter `0`
   - You should see: 🧪 Test mode: Zero budget activation (no funds required)

5. **Save as Draft**:
   - Click "Save Draft" button
   - The activation will be created with `test_mode = true`

6. **Publish the Activation**:
   - After draft is saved, click "Publish"
   - **No funds will be locked** (wallet operations skipped)
   - Activation syncs to Dobbletap

---

## 🔍 Verification Steps

### Check DTTracker Database

Run this in Supabase SQL Editor:

```sql
-- View your test activation
SELECT
  id,
  title,
  type,
  status,
  total_budget,
  test_mode,
  synced_to_dobble_tap,
  dobble_tap_activation_id,
  created_at
FROM activations
WHERE test_mode = true
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result**:
- `test_mode`: `true`
- `total_budget`: `0`
- `status`: `live` (after publishing)
- `synced_to_dobble_tap`: `true`
- `dobble_tap_activation_id`: Should have a UUID

### Check Dobbletap Database

Login to Dobbletap and run:

```sql
-- View campaigns from DTTracker
SELECT
  id,
  title,
  source,
  campaign_type,
  total_budget,
  status,
  created_at
FROM campaigns
WHERE source = 'dttracker'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result**:
- Campaign should exist with matching title
- `source`: `'dttracker'`
- `total_budget`: `0`
- `status`: `'active'` or similar

### Check Webhook Events

```sql
-- View outbound webhooks from DTTracker to Dobbletap
SELECT
  event_type,
  campaign_id,
  timestamp,
  payload->>'title' as title,
  processed_at
FROM webhook_events
WHERE campaign_id = 'YOUR_ACTIVATION_ID'
ORDER BY timestamp DESC;
```

### Check Function Logs

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. Click on `activation-publish`
3. View logs to see: "Skipping wallet operations for test mode activation"

---

## 🎯 What Happens with Zero-Budget Activations

### ✅ What DOES Happen:
1. ✅ Activation created in DTTracker database
2. ✅ Marked as `test_mode = true`
3. ✅ Status changes to `live` when published
4. ✅ **Syncs to Dobbletap** via webhook
5. ✅ Shows in Dobbletap as a campaign
6. ✅ Webhook events logged for debugging

### ❌ What DOES NOT Happen:
1. ❌ No wallet balance check
2. ❌ No funds locked from workspace wallet
3. ❌ No service fee charged
4. ❌ No wallet transactions created
5. ❌ No payment processing

---

## 📊 Quick Test Commands

### Create Test Activation via SQL (Alternative Method)

If you want to create a test activation directly via SQL:

```sql
-- Get your workspace ID first
SELECT id, name FROM workspaces WHERE created_by = auth.uid() LIMIT 1;

-- Create test activation
INSERT INTO activations (
  workspace_id,
  created_by,
  type,
  title,
  brief,
  status,
  deadline,
  total_budget,
  test_mode,
  prize_structure,
  winner_count,
  platforms,
  synced_to_dobble_tap
) VALUES (
  'YOUR_WORKSPACE_ID',  -- Replace with your workspace ID
  auth.uid(),
  'contest',
  'SQL Test Activation',
  'Created via SQL for testing',
  'draft',
  NOW() + INTERVAL '7 days',
  0,  -- Zero budget
  true,  -- Test mode
  '{}'::jsonb,
  20,
  ARRAY['tiktok'],
  false
) RETURNING id, title, test_mode, total_budget;
```

Then publish it:

```sql
-- Publish the test activation (triggers sync to Dobbletap)
-- Replace 'ACTIVATION_ID' with the ID returned above
UPDATE activations
SET status = 'live', synced_to_dobble_tap = true
WHERE id = 'ACTIVATION_ID';
```

**Note**: Publishing via SQL bypasses the sync function. Use the UI method for full E2E testing.

---

## 🐛 Troubleshooting

### Issue: "Invalid total budget" error when publishing

**Solution**: Make sure the database migration ran successfully. Check:

```sql
-- Verify test_mode column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'activations'
AND column_name = 'test_mode';

-- Should return: test_mode | boolean
```

### Issue: Activation not showing in Dobbletap

**Solution**: Check webhook events and function logs:

```sql
-- Check if webhook was sent
SELECT * FROM webhook_events
WHERE event_type = 'activation_created'
ORDER BY created_at DESC LIMIT 1;
```

### Issue: Wallet balance error even with zero budget

**Solution**: Clear your browser cache and reload. The UI should show "Test mode" indicator.

---

## 🔄 Testing the Full Integration Flow

### Complete Test Scenario:

1. **Create Zero-Budget Activation** (DTTracker)
   ```
   Title: "Integration Test - 2024-02-07"
   Budget: 0
   Type: Contest
   Status: Draft → Live
   ```

2. **Verify Sync to Dobbletap**
   - Check Dobbletap campaigns table
   - Confirm campaign appears with `source = 'dttracker'`

3. **Simulate Creator Submission** (Dobbletap → DTTracker)
   ```bash
   curl -X POST \
     "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/dobbletap-webhook-submission" \
     -H "Authorization: Bearer 617f081fbbdbf7978a7c607fc4c9769cd882abf82af6dc52b9d1a9fe70fea655" \
     -H "Content-Type: application/json" \
     -d '{
       "eventType": "submission_created",
       "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
       "data": {
         "creatorCampaignId": "YOUR_ACTIVATION_ID",
         "assetId": "'$(uuidgen | tr '[:upper:]' '[:lower:]')'",
         "version": 1,
         "assetUrl": "https://example.com/test-video.mp4",
         "submittedBy": "'$(uuidgen | tr '[:upper:]' '[:lower:]')'",
         "submittedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
       }
     }'
   ```

4. **Verify Submission in DTTracker**
   ```sql
   SELECT * FROM activation_submissions
   WHERE activation_id = 'YOUR_ACTIVATION_ID'
   ORDER BY submitted_at DESC;
   ```

---

## 📚 Related Files

- **Migration**: `supabase/migrations/20260207999999_allow_zero_budget_testing.sql`
- **Edge Function**: `supabase/functions/activation-publish/index.ts`
- **UI Component**: `src/app/components/activations/activation-create.tsx`
- **API**: `src/lib/api/activations.ts`

---

## ✨ Summary

You can now create **test activations with zero budget** to verify the DTTracker ↔ Dobbletap integration without needing real funds. This is perfect for:

- ✅ Testing webhook flows
- ✅ Verifying data sync
- ✅ QA and staging environments
- ✅ Integration demos
- ✅ Development testing

**Remember**: Test mode activations (`test_mode = true`) bypass all wallet/payment operations but still sync to Dobbletap and receive webhooks normally.

---

**Need Help?** Check the function logs at:
https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions/activation-publish

**Test the webhook endpoints** using: `./test-e2e-integration.sh`
