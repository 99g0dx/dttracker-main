# Testing Real Paystack Funding

This guide walks you through testing real wallet funding with Paystack.

## Prerequisites

1. ✅ Paystack account with **LIVE** keys (not test keys)
2. ✅ Webhook handler deployed to Vercel (`api/payments/paystack-webhook.ts`)
3. ✅ Environment variables configured in Vercel
4. ✅ Database tables created (`workspace_wallets`, `wallet_transactions`, `paystack_events`)

## Step 1: Find Your Workspace ID

You need your `workspace_id` to reset the wallet balance. Choose one method:

### Option A: Using SQL Script (Recommended)

1. Open **Supabase Dashboard → SQL Editor**
2. Run the script: `scripts/find-workspace-id.sql`
3. Replace `'YOUR_EMAIL'` with your email address
4. Copy the `workspace_id` from the results

### Option B: Using TypeScript Script

```bash
# Make sure .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npx tsx scripts/reset-wallet-balance.ts
```

This will list all wallets. Copy the `workspace_id` you want to reset.

### Option C: From Browser Console

1. Open your app in the browser
2. Open Developer Console (F12)
3. Run: `localStorage.getItem('dt_active_workspace_' + (await supabase.auth.getUser()).data.user.id)`
4. Or check the Network tab when loading the wallet page

## Step 2: Reset Wallet Balance

### Option A: Using SQL (Quick)

1. Open **Supabase Dashboard → SQL Editor**
2. Open `scripts/reset-wallet-balance.sql`
3. Replace `'YOUR_WORKSPACE_ID'` with your actual workspace_id UUID
4. Run the SQL

### Option B: Using TypeScript Script

```bash
npx tsx scripts/reset-wallet-balance.ts YOUR_WORKSPACE_ID
```

Replace `YOUR_WORKSPACE_ID` with your actual UUID.

## Step 3: Verify Webhook Setup

Run the verification script:

```bash
npx tsx scripts/verify-webhook-setup.ts
```

This checks:
- ✅ Environment variables are set
- ✅ Database tables exist
- ✅ Webhook URL is correct

### Manual Verification

1. **Check Vercel Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify these are set:
     - `PAYSTACK_SECRET_KEY` (your LIVE secret key)
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `VITE_APP_URL` or `APP_URL` (your production domain)

2. **Check Paystack Webhook Configuration:**
   - Go to Paystack Dashboard → Settings → API Keys & Webhooks
   - Verify webhook URL: `https://your-domain.vercel.app/api/payments/paystack-webhook`
   - Make sure it's enabled and using **LIVE** mode

## Step 4: Test Real Funding

1. **Open your app** and navigate to the Wallet page

2. **Click "Fund Wallet"** and enter an amount (e.g., ₦1,000)

3. **Complete the payment** using Paystack's payment page:
   - Use a real card (or bank transfer)
   - Complete the payment flow

4. **After payment:**
   - You'll be redirected to `/wallet?fund=success`
   - The wallet balance should update automatically
   - If not, click the refresh button (🔄) in the wallet UI

## Step 5: Verify Success

### Check Wallet Balance

1. Refresh the wallet page
2. Verify the balance shows the funded amount
3. Check the transaction list shows a "fund" transaction

### Check Database

Run this SQL in Supabase:

```sql
-- Check wallet balance
SELECT workspace_id, balance, locked_balance, updated_at
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- Check transactions
SELECT id, type, amount, balance_after, created_at, metadata
FROM wallet_transactions
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Check Paystack events
SELECT event_id, event_type, reference, amount, created_at
FROM paystack_events
ORDER BY created_at DESC
LIMIT 5;
```

### Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `api/payments/paystack-webhook`
3. Check the logs for:
   - ✅ `200` status code
   - ✅ `processed: true` in response
   - ✅ No error messages

## Troubleshooting

### Balance Not Updating

1. **Check webhook logs** in Vercel for errors
2. **Verify webhook URL** in Paystack Dashboard matches your Vercel URL
3. **Check signature verification** - ensure `PAYSTACK_SECRET_KEY` is correct
4. **Verify workspace_id** in Paystack metadata matches your actual workspace_id

### Webhook Not Receiving Events

1. **Check Paystack webhook logs:**
   - Paystack Dashboard → Settings → API Keys & Webhooks
   - Click "View Webhook Events"
   - Check if events are being sent and their status

2. **Verify webhook URL is accessible:**
   ```bash
   curl -X POST https://your-domain.vercel.app/api/payments/paystack-webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```
   Should return `405 Method Not Allowed` (not 404)

3. **Check Vercel deployment:**
   - Ensure `api/payments/paystack-webhook.ts` is deployed
   - Check Vercel build logs for TypeScript errors

### "Demo Money" Still Showing

1. **Clear browser cache** and hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
2. **Check database** - verify `workspace_wallets.balance` is updated
3. **Check React Query cache** - the refresh button should invalidate queries
4. **Verify webhook processed** - check `paystack_events` table for the event

## Support

If issues persist:

1. Check Vercel function logs for detailed error messages
2. Check Supabase logs for database errors
3. Verify all environment variables are set correctly
4. Ensure you're using **LIVE** Paystack keys (not test keys)
