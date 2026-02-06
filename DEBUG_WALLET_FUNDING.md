# Debug Wallet Funding Not Reflecting

Since your webhook is the **Supabase Edge Function** (`https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/paystack-webhook`), follow these steps:

## Step 1: Check Supabase Edge Function Logs

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. Click on **`paystack-webhook`** function
3. Click the **"Logs"** tab
4. Make a test payment (or check recent logs)
5. Look for these log messages:

### ✅ Success logs:
- `"Paystack webhook received: charge.success"`
- `"Wallet funded for workspace [workspace_id], amount ₦[amount]"`

### ❌ Error logs:
- `"No workspace_id in metadata for charge.success"`
- `"Failed to fetch wallet:"`
- `"Failed to update wallet:"`
- `"Invalid Paystack signature"`

## Step 2: Check Database Directly

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Replace YOUR_WORKSPACE_ID with your actual workspace_id UUID
-- (Get it from the wallet page or use scripts/find-workspace-id.sql)

-- Check wallet balance
SELECT workspace_id, balance, locked_balance, updated_at
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- Check recent fund transactions
SELECT 
  type,
  amount,
  balance_after,
  metadata->>'paystack_reference' as paystack_ref,
  created_at
FROM wallet_transactions
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
  AND type = 'fund'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- ✅ If `balance` > 0 → Webhook **IS** updating the database
- ✅ If transactions exist → Webhook **IS** processing
- ❌ If balance = 0 and no transactions → Webhook **NOT** processing or failing

## Step 3: Verify Webhook Configuration

1. **Check Paystack Dashboard:**
   - Go to **Paystack Dashboard → Settings → API Keys & Webhooks**
   - Verify webhook URL: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/paystack-webhook`
   - Check if it's **enabled** and using **LIVE** mode (not test)

2. **Check Supabase Edge Function Secrets:**
   - Go to **Supabase Dashboard → Edge Functions → Settings → Secrets**
   - Verify these are set:
     - `PAYSTACK_SECRET_KEY` (your LIVE secret key)
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`

## Step 4: Test Webhook Manually

You can test if the webhook is receiving events:

1. **Check Paystack Webhook Events:**
   - Paystack Dashboard → Settings → API Keys & Webhooks → **View Webhook Events**
   - Look for recent `charge.success` events
   - Check their status (success/failed)

2. **Check if webhook is being called:**
   - Look at Supabase Edge Function logs around the time you made the payment
   - You should see `"Paystack webhook received: charge.success"`

## Common Issues & Fixes

### Issue 1: "No workspace_id in metadata"
**Cause:** Paystack isn't sending `workspace_id` in metadata  
**Fix:** Check `wallet-fund-initialize` function sends metadata correctly:
```typescript
metadata: {
  workspace_id: workspaceId,  // ← Must be included
  purpose: "wallet_fund",
  ...
}
```

### Issue 2: Webhook logs show success but balance doesn't update
**Cause:** Frontend not refetching or caching issue  
**Fix:** 
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Click refresh button on wallet page
- Check if `workspace_id` in webhook matches `activeWorkspaceId` in frontend

### Issue 3: "Invalid Paystack signature"
**Cause:** Wrong `PAYSTACK_SECRET_KEY` in Supabase secrets  
**Fix:** 
- Verify secret key matches Paystack Dashboard → Settings → API Keys
- Make sure it's LIVE key (starts with `sk_live_...`) not test key
- Update in Supabase Edge Functions → Settings → Secrets

### Issue 4: Webhook not being called
**Cause:** Paystack webhook URL misconfigured or disabled  
**Fix:**
- Verify URL in Paystack Dashboard matches exactly: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/paystack-webhook`
- Make sure webhook is enabled
- Check Paystack webhook events to see if events are being sent

## Quick Diagnostic Script

Run `scripts/check-webhook-success.sql` in Supabase SQL Editor to see:
- Current wallet balance
- Recent fund transactions
- Billing events (if logged)
- Latest transaction details

## Next Steps

1. **Check Supabase logs** first - this will tell you if webhook is running
2. **Check database** - see if balance is actually being updated
3. **Check frontend** - verify it's refetching (we added aggressive polling)

If webhook logs show success but frontend doesn't update:
- The frontend now polls every 2s for 60s after payment
- If balance updates in DB but not UI, it's a frontend caching issue
- Try hard refresh or check browser console for errors
