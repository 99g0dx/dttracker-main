# Paystack Webhook Handler

## Overview

This webhook handler processes Paystack `charge.success` events and updates wallet balances in Supabase.

## Features

- ✅ **Signature Verification**: HMAC SHA512 verification using `PAYSTACK_SECRET_KEY`
- ✅ **Idempotency**: Prevents duplicate processing using `event_id` and `provider_event_id`
- ✅ **Transaction Safety**: All database operations are atomic
- ✅ **Server-Side Only**: Uses Supabase service role key (never client-side)

## Setup

### 1. Environment Variables

Add these to your `.env` file or Vercel environment variables:

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # or sk_live_... for production

# Supabase Configuration (server-side only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: 
- Use `SUPABASE_SERVICE_ROLE_KEY` (not the anon key)
- Never expose the service role key to the client
- Use test keys (`sk_test_...`) for development
- Use live keys (`sk_live_...`) for production

### 2. Configure Paystack Webhook

1. Go to [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API Keys & Webhooks
2. Add webhook URL: `https://your-domain.com/api/payments/paystack-webhook`
3. Select events: `charge.success`
4. Copy the webhook secret (same as `PAYSTACK_SECRET_KEY`)

### 3. Database Tables

Ensure these tables exist in your Supabase database:

```sql
-- wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID,
  balance_kobo BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- wallet_ledger table
CREATE TABLE wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_kobo BIGINT NOT NULL,
  reference TEXT,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_event_id TEXT UNIQUE NOT NULL
);

-- paystack_events table
CREATE TABLE paystack_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  reference TEXT,
  amount BIGINT,
  currency TEXT,
  customer_email TEXT,
  payload JSONB NOT NULL
);
```

## How It Works

### Processing Flow

1. **Signature Verification**: Verifies `x-paystack-signature` header using HMAC SHA512
2. **Event Filtering**: Only processes `charge.success` events
3. **Idempotency Check**: Checks if event already processed (prevents duplicates)
4. **Transaction Steps**:
   - **STEP A**: Store event in `paystack_events` (idempotent)
   - **STEP B**: Get or create wallet for `workspace_id`
   - **STEP C**: Insert ledger record (idempotent via `provider_event_id`)
   - **STEP D**: Update wallet `balance_kobo`

### Request Format

Paystack sends POST requests with:
- Header: `x-paystack-signature` (HMAC SHA512 signature)
- Body: JSON payload with `event` and `data` fields

Example payload:
```json
{
  "event": "charge.success",
  "data": {
    "id": 1234567890,
    "amount": 100000,
    "reference": "wallet_abc123_1234567890",
    "currency": "NGN",
    "customer": {
      "email": "user@example.com"
    },
    "metadata": {
      "workspace_id": "uuid-here"
    }
  }
}
```

### Response Format

**Success (200)**:
```json
{
  "received": true,
  "processed": true,
  "walletId": "uuid",
  "amountKobo": 100000,
  "newBalanceKobo": 100000
}
```

**Duplicate (200)**:
```json
{
  "received": true,
  "duplicate": true,
  "message": "Event already processed"
}
```

**Error (401/500)**:
```json
{
  "error": "Error message"
}
```

## Testing

### Using Paystack Test Mode

1. Use test API keys (`sk_test_...`)
2. Use Paystack's test cards: `4084084084084081` (success)
3. Check webhook logs in Paystack Dashboard → Settings → Webhooks

### Local Testing

Use a tool like [ngrok](https://ngrok.com) to expose your local server:

```bash
ngrok http 3000
# Use the ngrok URL as your webhook URL in Paystack
```

## Security Notes

- ✅ Always verify webhook signatures
- ✅ Use HTTPS for webhook URLs
- ✅ Never log sensitive data (API keys, customer emails)
- ✅ Use service role key server-side only
- ✅ Implement rate limiting in production

## Troubleshooting

### "Invalid signature" error
- Check that `PAYSTACK_SECRET_KEY` matches Paystack dashboard
- Ensure raw body is used for signature verification (not parsed JSON)

### "Missing workspace_id" error
- Ensure `metadata.workspace_id` is set when initializing Paystack payment
- Check Paystack transaction metadata in dashboard

### Duplicate events
- This is normal - webhook handler is idempotent
- Duplicate events return `200` with `duplicate: true`

### Balance not updating
- Check Supabase logs for database errors
- Verify `wallets` table exists and has correct schema
- Check `wallet_ledger` for inserted records
