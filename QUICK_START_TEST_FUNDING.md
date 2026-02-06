# Quick Start: Test Real Funding

## 🚀 Fastest Way (5 minutes)

### Step 1: Find Your Workspace ID (2 min)

**If you got "No rows returned", try these:**

**Option A: List All Users (Find Your Email First)**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this to see all users:

```sql
SELECT 
  u.id as user_id,
  u.email,
  COALESCE(wm.workspace_id, u.id) as workspace_id
FROM auth.users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
ORDER BY u.created_at DESC;
```

3. Find your email and copy the `workspace_id`

**Option B: One-Step Setup (Creates Wallet if Missing)**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `scripts/find-and-reset-wallet.sql`
3. Replace `'YOUR_EMAIL'` with your actual email
4. Run the script - it will find your workspace AND create/reset the wallet

**Option C: Manual Setup**

1. Run this to find your workspace_id:

```sql
-- Replace YOUR_EMAIL with your actual email
SELECT 
  u.id as user_id,
  u.email,
  COALESCE(wm.workspace_id, u.id) as workspace_id
FROM auth.users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
WHERE u.email = 'YOUR_EMAIL';
```

2. Copy the `workspace_id` UUID
3. Then create/reset wallet (see Step 2)

### Step 2: Create/Reset Wallet Balance (1 min)

**To clear balance AND all transaction history** (no old "Funding" entries on the page), use:
- **Supabase SQL Editor** → run `scripts/clear-wallet-all.sql` (replace `YOUR_WORKSPACE_ID`).
- That script deletes all `wallet_transactions` and sets balance to 0.

**To only reset balance** (transactions stay):

**If wallet doesn't exist yet, use INSERT instead of UPDATE:**

1. Still in **Supabase SQL Editor**, run:

```sql
-- Replace YOUR_WORKSPACE_ID with the UUID you found above
-- This creates the wallet if it doesn't exist, or resets it if it does
INSERT INTO workspace_wallets (workspace_id, balance, locked_balance, currency, updated_at)
VALUES ('YOUR_WORKSPACE_ID', 0, 0, 'NGN', NOW())
ON CONFLICT (workspace_id) 
DO UPDATE SET
  balance = 0,
  locked_balance = 0,
  updated_at = NOW();

-- Verify it worked
SELECT workspace_id, balance, locked_balance, currency
FROM workspace_wallets 
WHERE workspace_id = 'YOUR_WORKSPACE_ID';
```

2. Replace `'YOUR_WORKSPACE_ID'` with your actual UUID
3. Click **Run**
4. Verify balance shows `0` and status shows wallet exists

**Alternative: Use the setup script**

Just run `scripts/find-and-reset-wallet.sql` - it does everything in one step!

### Step 3: Verify Webhook is Deployed (1 min)

1. **Check Vercel Deployment:**
   - Go to Vercel Dashboard → Your Project
   - Verify `api/payments/paystack-webhook.ts` exists in your project
   - Check that it's deployed (not just in code)

2. **Check Vercel Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify these are set:
     - `PAYSTACK_SECRET_KEY` (your LIVE secret key starting with `sk_live_...`)
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `VITE_APP_URL` or `APP_URL` (your production domain, e.g., `https://your-app.vercel.app`)

3. **Check Paystack Webhook URL:**
   - Go to Paystack Dashboard → Settings → API Keys & Webhooks
   - Verify webhook URL is: `https://your-domain.vercel.app/api/payments/paystack-webhook`
   - Make sure it's enabled and using **LIVE** mode (not test)

### Step 4: Test Funding (1 min)

1. **Open your app** and go to the Wallet page
2. **Click "Fund Wallet"** and enter an amount (e.g., ₦1,000)
3. **Complete payment** on Paystack
4. **After redirect**, check:
   - Balance updated? ✅
   - Transaction appears? ✅
   - If not, click the refresh button (🔄) in the wallet UI

### Step 5: Verify Success

**Check Database:**

```sql
-- Check wallet balance
SELECT workspace_id, balance, locked_balance, updated_at
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- Check latest transaction
SELECT type, amount, balance_after, created_at, metadata
FROM wallet_transactions
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
ORDER BY created_at DESC
LIMIT 1;
```

**Check Vercel Logs:**

1. Go to Vercel Dashboard → Your Project → Functions
2. Click `api/payments/paystack-webhook`
3. Check logs for successful processing (status 200)

## 🐛 Troubleshooting

### "Balance not updating"

1. **Check Vercel function logs** - look for errors
2. **Verify webhook URL** in Paystack matches your Vercel URL exactly
3. **Check workspace_id** - make sure Paystack metadata includes correct `workspace_id`

### "Webhook not receiving events"

1. **Check Paystack webhook events:**
   - Paystack Dashboard → Settings → API Keys & Webhooks → View Webhook Events
   - See if events are being sent and their status

2. **Test webhook URL manually:**
   ```bash
   curl https://your-domain.vercel.app/api/payments/paystack-webhook
   ```
   Should return `405 Method Not Allowed` (not 404)

### "Still showing demo money"

1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Check database directly - verify `workspace_wallets.balance` is updated
3. Click refresh button in wallet UI

## ✅ Success Checklist

- [ ] Found workspace_id
- [ ] Reset wallet balance to 0
- [ ] Verified webhook deployed to Vercel
- [ ] Verified environment variables in Vercel
- [ ] Verified webhook URL in Paystack Dashboard
- [ ] Made test payment
- [ ] Balance updated in UI
- [ ] Transaction appears in list
- [ ] Verified in database

## 📞 Need Help?

Check the detailed guide: `TEST_REAL_FUNDING.md`
