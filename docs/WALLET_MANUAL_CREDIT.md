# Manual wallet credit & making sure payment works

## When payment succeeded on Paystack but wallet wasn’t credited

Use the **direct script** (no Edge Function deploy, no 404):

```bash
# Set env (or use .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

npx tsx scripts/credit-wallet-manual.ts "<workspace_id>" "<paystack_reference>" <amount_ngn>
```

Or via npm:

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." npm run credit-wallet -- "<workspace_id>" "<paystack_reference>" 5000
```

**Where to get the values:**

- **workspace_id** – Supabase → Table Editor → `workspaces` (column `id`) or `workspace_members.workspace_id` for the paying user.
- **paystack_reference** – Paystack Dashboard → **Transactions** → select the transaction → copy **Reference** (e.g. `wallet_550e8400_1707123456789`).
- **amount_ngn** – Amount in Naira to credit (e.g. `5000` for ₦5,000).

The script is idempotent: if a fund transaction already exists for that reference and workspace, it skips and does not double-credit.

---

## Alternative: Edge Function + shell script

If you prefer the Edge Function:

1. Deploy: `supabase functions deploy wallet-credit-manual`
2. Run: `./scripts/credit-wallet-manual.sh "<workspace_id>" "<paystack_reference>" <amount_ngn>`

If you get **404 Not Found**, the function isn’t deployed or the URL is wrong; use the direct script above instead.

---

## Making sure wallet funding works end-to-end

### 1. Webhook URL in Paystack

- Paystack Dashboard → **Settings** → **API Keys & Webhooks** → **Webhook URL**.
- Set it to your `paystack-webhook` endpoint, for example:
  - Supabase: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`
  - Or your proxy: `https://your-domain.com/api/payments/webhook` (if you proxy to Supabase).
- Paystack must be able to reach this URL on the internet (no localhost).

### 2. Wallet funding flow sends workspace_id

- User funds from the app → `wallet-fund-initialize` is called with `workspaceId`.
- That call creates a Paystack transaction with **metadata**: `workspace_id`, `purpose: "wallet_fund"`.
- The webhook reads `data.metadata.workspace_id` and credits that workspace. If `workspace_id` is missing, the webhook logs “No workspace_id in metadata” and does not credit.

### 3. Test a real payment

- Use a small test amount (Paystack test mode if available).
- After payment succeeds, check:
  - **Wallet in app** – balance and “Funding” transaction.
  - **Supabase** – `workspace_wallets.balance` and `wallet_transactions` (type `fund`) for that workspace.

### 4. If balance still doesn’t update

- **Supabase logs** – Edge Functions → `paystack-webhook` → Logs. Look for:
  - “No workspace_id in metadata” (fix metadata in `wallet-fund-initialize`).
  - “Wallet funded for workspace …” (success).
  - Any 500 or error messages.
- **Paystack** – Developers → Webhooks → delivery history for that event (success/failure, response code).
- **Manual credit** – Use the direct script above to credit that payment once, then fix webhook/config so future payments credit automatically.
