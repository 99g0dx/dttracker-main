# Wallet + Paystack Setup

How the wallet funding flow works and what to configure so the wallet "fetches" (receives) funds from Paystack.

## Flow

1. **User clicks "Fund Wallet"** → Frontend calls `wallet-fund-initialize` Edge Function.
2. **Initialize** → Function calls **Paystack API** `POST /transaction/initialize` with amount, metadata (`workspace_id`, `purpose: "wallet_fund"`), and `callback_url`. Paystack returns `authorization_url`.
3. **Redirect** → User is sent to Paystack to pay.
4. **After payment** → **Paystack sends a webhook** to your `paystack-webhook` Edge Function with event `charge.success`.
5. **Webhook** → Function credits `workspace_wallets` and inserts `wallet_transactions`. Frontend refetches balance when user returns to `/wallet?fund=success` or refocuses the tab.

So the wallet does **not** "fetch" balance from Paystack directly. Paystack **pushes** the result to your webhook; your app updates the DB and the frontend reads from the DB.

## Checklist

### 1. Deploy Edge Functions

```bash
supabase functions deploy wallet-fund-initialize
supabase functions deploy paystack-webhook
```

Without these, the app cannot call Paystack (initialize) or receive Paystack’s webhook (credit wallet).

### 2. Set secrets for both functions

In **Supabase Dashboard** → **Edge Functions** → select the function → **Secrets** (or via CLI):

- `PAYSTACK_SECRET_KEY` – Your Paystack secret key (used to call Paystack API and to verify webhook signature).
- `SUPABASE_URL` – Project URL (e.g. `https://xxxx.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key (for DB updates in the webhook).

For **wallet-fund-initialize** only (optional):

- `APP_URL` or `VITE_APP_URL` – Base URL for the redirect after payment (e.g. `https://yourapp.com`). If not set, the frontend sends `redirectUrl: window.location.origin` so the callback URL is still correct.

### 3. Configure webhook in Paystack

In **Paystack Dashboard** → **Settings** → **Webhooks**:

- **URL:** `https://<your-project-ref>.supabase.co/functions/v1/paystack-webhook`  
  Example: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/paystack-webhook`
- Paystack will send `charge.success` (and other events) to this URL. Your `paystack-webhook` function must be deployed and have `PAYSTACK_SECRET_KEY` set so signature verification succeeds.

### 4. Frontend env

In `.env`:

- `VITE_SUPABASE_URL` – Same Supabase project URL (so the app calls the same project’s Edge Functions).

## Verify setup

1. **Check that the initialize function is reachable**  
   Open in a browser (use your real project URL):
   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/wallet-fund-initialize
   ```
   You should see JSON like: `{"ok":true,"message":"wallet-fund-initialize is deployed",...}`  
   If you get 404 or the page fails to load, the function is not deployed or the URL is wrong.

2. **Check Supabase function logs**  
   Dashboard → Edge Functions → `wallet-fund-initialize` or `paystack-webhook` → Logs.  
   Look for errors (e.g. "PAYSTACK_SECRET_KEY is not configured", "Paystack request failed", "No workspace_id in metadata").

3. **Check Paystack webhook**  
   Paystack Dashboard → Settings → Webhooks. Ensure the URL is exactly:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`  
   You can also check Paystack’s webhook delivery logs for failed attempts.

## Troubleshooting

| Symptom | Check |
|--------|--------|
| "Failed to fetch" when clicking Fund Wallet | Open the GET URL above in a browser. If it fails, deploy `wallet-fund-initialize` and ensure `VITE_SUPABASE_URL` in `.env` matches that project. Restart dev server after changing `.env`. |
| Toast shows "PAYSTACK_SECRET_KEY is not configured" or "Paystack request failed" | Set `PAYSTACK_SECRET_KEY` in Supabase → Edge Functions → `wallet-fund-initialize` → Secrets. Use your Paystack secret key (starts with `sk_`). |
| Redirect to Paystack works but balance never updates | Deploy `paystack-webhook`; set webhook URL in Paystack; set `PAYSTACK_SECRET_KEY` (and `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) on the webhook function. |
| Webhook returns 401 | Webhook signature verification failed – use the same `PAYSTACK_SECRET_KEY` in Paystack and in the function. |
| Webhook runs but wallet not credited | Check Supabase function logs for "No workspace_id in metadata" – Paystack must send the metadata you set in initialize (we send `workspace_id`, `purpose: "wallet_fund"`). |
