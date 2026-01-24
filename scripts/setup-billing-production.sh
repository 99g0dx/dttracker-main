#!/bin/bash
# =============================================================================
# DTTracker Billing Production Setup Script
# =============================================================================
# This script guides you through setting up Paystack billing for production.
#
# Prerequisites:
# - Paystack account (https://dashboard.paystack.com)
# - Supabase project with Edge Functions deployed
# - Production domain verified in Paystack Dashboard
#
# Usage: ./scripts/setup-billing-production.sh
# =============================================================================

set -e

echo ""
echo "=============================================="
echo "  DTTracker Billing Production Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to print checklist items
print_check() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_pending() {
    echo -e "  ${YELLOW}○${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

# =============================================================================
# STEP 1: Paystack Dashboard Configuration
# =============================================================================
print_section "STEP 1: Paystack Dashboard Configuration"

echo "Open your Paystack Dashboard: https://dashboard.paystack.com"
echo ""
echo "Complete the following in LIVE MODE (toggle at top-right):"
echo ""
print_pending "1. Go to Settings → API Keys & Webhooks"
print_pending "   - Copy your Live Secret Key (sk_live_...)"
print_pending "   - Copy your Live Public Key (pk_live_...)"
echo ""
print_pending "2. Go to Settings → Webhooks"
print_pending "   - Add webhook URL: https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/billing_webhook_paystack"
print_pending "   - Enable events: charge.success, charge.failed, subscription.create, subscription.disable"
print_pending "   - Copy the Webhook Secret"
echo ""
print_pending "3. Go to Settings → Preferences"
print_pending "   - Verify your production domain is added"
echo ""

read -p "Press Enter when you've completed Paystack Dashboard setup..."

# =============================================================================
# STEP 2: Create Paystack Plans
# =============================================================================
print_section "STEP 2: Create Paystack Plans"

echo "You need to create 12 plans in Paystack (6 base + 6 seat add-ons)."
echo ""
echo "Option A: Run the automated script (recommended)"
echo "  PAYSTACK_SECRET_KEY=sk_live_xxx npx ts-node scripts/create-paystack-plans.ts"
echo ""
echo "Option B: Create manually in Paystack Dashboard → Products → Plans"
echo ""

read -p "Press Enter when plans are created..."

# =============================================================================
# STEP 3: Run Database Migrations
# =============================================================================
print_section "STEP 3: Database Migrations"

echo "Run the billing migrations in your Supabase SQL Editor:"
echo ""
echo "Files to run in order:"
print_pending "1. database/migrations/030_create_plan_catalog.sql"
print_pending "2. database/migrations/031_seed_plan_catalog.sql"
print_pending "3. database/migrations/032_alter_workspace_subscriptions.sql"
print_pending "4. database/migrations/033_create_usage_counters.sql"
print_pending "5. database/migrations/034_create_campaign_platform_scrapes.sql"
print_pending "6. database/migrations/035_create_enforcement_rpcs.sql"
print_pending "7. database/migrations/036_migrate_existing_subscriptions.sql"
echo ""
echo "Or run the combined migration:"
print_pending "supabase/migrations/20260201000004_add_billing_v2.sql"
echo ""

read -p "Press Enter when migrations are complete..."

# =============================================================================
# STEP 4: Update plan_catalog with Paystack Plan Codes
# =============================================================================
print_section "STEP 4: Link Paystack Plan Codes"

echo "After running create-paystack-plans.ts, copy the generated SQL"
echo "and run it in Supabase SQL Editor to link the plan codes."
echo ""
echo "Example SQL (use your actual plan codes):"
echo ""
cat << 'EOF'
UPDATE plan_catalog SET paystack_base_plan_code = 'PLN_xxx' WHERE tier = 'starter' AND billing_cycle = 'monthly';
UPDATE plan_catalog SET paystack_seat_plan_code = 'PLN_xxx' WHERE tier = 'starter' AND billing_cycle = 'monthly';
-- ... etc for all 12 plans
EOF
echo ""

read -p "Press Enter when plan codes are linked..."

# =============================================================================
# STEP 5: Supabase Edge Functions Environment
# =============================================================================
print_section "STEP 5: Configure Supabase Edge Functions"

echo "Go to: Supabase Dashboard → Edge Functions → Settings"
echo ""
echo "Add these environment variables:"
echo ""
print_pending "PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx"
print_pending "PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx"
print_pending "APP_URL=https://your-production-domain.com"
print_pending "BILLING_CURRENCY=USD"
print_pending "PAYSTACK_CURRENCY=USD"
echo ""
echo "Optional (if using currency conversion):"
print_pending "PAYSTACK_CURRENCY_RATE=1"
echo ""

read -p "Press Enter when Edge Function env vars are set..."

# =============================================================================
# STEP 6: Deploy Edge Functions
# =============================================================================
print_section "STEP 6: Deploy Edge Functions"

echo "Deploy the billing Edge Functions to Supabase:"
echo ""
echo "  supabase functions deploy billing_create_checkout"
echo "  supabase functions deploy billing_webhook_paystack"
echo "  supabase functions deploy billing_get_catalog"
echo "  supabase functions deploy billing_update_seats"
echo "  supabase functions deploy billing_cancel"
echo ""
echo "Or deploy all at once:"
echo "  supabase functions deploy"
echo ""

read -p "Press Enter when functions are deployed..."

# =============================================================================
# STEP 7: Frontend Environment
# =============================================================================
print_section "STEP 7: Configure Frontend Environment"

echo "Set these in your production environment (Vercel, Netlify, etc.):"
echo ""
print_pending "VITE_SUPABASE_URL=https://your-project.supabase.co"
print_pending "VITE_SUPABASE_ANON_KEY=eyJhbG..."
print_pending "VITE_APP_URL=https://your-production-domain.com"
echo ""

read -p "Press Enter when frontend env vars are set..."

# =============================================================================
# STEP 8: Test the Integration
# =============================================================================
print_section "STEP 8: Test the Integration"

echo "Test your billing integration:"
echo ""
print_pending "1. Visit your production site"
print_pending "2. Go to /subscription or /payment?plan=pro"
print_pending "3. Click 'Continue to Paystack'"
print_pending "4. Complete a test payment (use Paystack test cards if in test mode)"
print_pending "5. Verify webhook is received (check Supabase Edge Function logs)"
print_pending "6. Verify subscription status updates in database"
echo ""

# =============================================================================
# Summary
# =============================================================================
print_section "Setup Complete!"

echo "Checklist summary:"
echo ""
print_check "Paystack Dashboard configured (API keys, webhooks, domain)"
print_check "Paystack plans created (12 plans)"
print_check "Database migrations run"
print_check "Plan codes linked in plan_catalog"
print_check "Edge Functions environment configured"
print_check "Edge Functions deployed"
print_check "Frontend environment configured"
echo ""
echo -e "${GREEN}Your billing system should now be ready for production!${NC}"
echo ""
echo "Troubleshooting:"
echo "  - Check Edge Function logs in Supabase Dashboard"
echo "  - Check webhook deliveries in Paystack Dashboard → Webhooks"
echo "  - Verify plan_catalog has correct paystack_*_plan_code values"
echo ""
