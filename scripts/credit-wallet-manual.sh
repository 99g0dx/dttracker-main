#!/usr/bin/env bash
#
# Manually credit a workspace wallet for a Paystack payment that succeeded
# but was not credited (e.g. webhook failed and Paystack doesn't support resend).
#
# Prerequisites:
#   - Deploy the Edge Function: supabase functions deploy wallet-credit-manual
#   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in env or .env)
#
# Usage:
#   ./scripts/credit-wallet-manual.sh <workspace_id> <paystack_reference> <amount_ngn>
#
# Example:
#   ./scripts/credit-wallet-manual.sh "550e8400-e29b-41d4-a716-446655440000" "wallet_550e8400_1707123456789" 5000
#
# Get workspace_id from: Supabase Dashboard -> Table Editor -> workspaces (or workspace_members).
# Get paystack_reference from: Paystack Dashboard -> Transactions -> reference.
# amount_ngn: amount in Naira (e.g. 5000 for ₦5,000).
#

set -e

# Load .env if present (optional)
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . .env
  set +a
fi

WORKSPACE_ID="${1:?Usage: $0 <workspace_id> <paystack_reference> <amount_ngn>}"
PAYSTACK_REFERENCE="${2:?Usage: $0 <workspace_id> <paystack_reference> <amount_ngn>}"
AMOUNT_NGN="${3:?Usage: $0 <workspace_id> <paystack_reference> <amount_ngn>}"

SUPABASE_URL="${SUPABASE_URL:?Set SUPABASE_URL (e.g. https://xxx.supabase.co)}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY}"

FUNCTION_URL="${SUPABASE_URL}/functions/v1/wallet-credit-manual"

echo "Crediting workspace $WORKSPACE_ID: reference=$PAYSTACK_REFERENCE amount=₦$AMOUNT_NGN"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d "{\"workspace_id\":\"$WORKSPACE_ID\",\"paystack_reference\":\"$PAYSTACK_REFERENCE\",\"amount_ngn\":$AMOUNT_NGN}")

# Portable: all but last line = body, last line = HTTP code (macOS head doesn't support -n -1)
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "Done (HTTP $HTTP_CODE)."
  exit 0
else
  echo "Failed (HTTP $HTTP_CODE)." >&2
  exit 1
fi
