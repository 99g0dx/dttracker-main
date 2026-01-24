-- Migration: Alter workspace_subscriptions for seat-based billing
-- Description: Add columns for tier, billing_cycle, seats, and two-subscription model

-- Add new columns to workspace_subscriptions
ALTER TABLE workspace_subscriptions
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS total_seats INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_seats INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paystack_seat_subscription_code TEXT,
  ADD COLUMN IF NOT EXISTS plan_catalog_id UUID;

-- Add foreign key constraint to plan_catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_workspace_subscriptions_plan_catalog'
  ) THEN
    ALTER TABLE workspace_subscriptions
      ADD CONSTRAINT fk_workspace_subscriptions_plan_catalog
      FOREIGN KEY (plan_catalog_id) REFERENCES plan_catalog(id);
  END IF;
END $$;

-- Add check constraint for tier
ALTER TABLE workspace_subscriptions
  DROP CONSTRAINT IF EXISTS check_tier_values;
ALTER TABLE workspace_subscriptions
  ADD CONSTRAINT check_tier_values
  CHECK (tier IN ('free', 'starter', 'pro', 'agency'));

-- Add check constraint for billing_cycle
ALTER TABLE workspace_subscriptions
  DROP CONSTRAINT IF EXISTS check_billing_cycle_values;
ALTER TABLE workspace_subscriptions
  ADD CONSTRAINT check_billing_cycle_values
  CHECK (billing_cycle IN ('monthly', 'yearly', 'none'));

-- Add check for seats
ALTER TABLE workspace_subscriptions
  DROP CONSTRAINT IF EXISTS check_seats_positive;
ALTER TABLE workspace_subscriptions
  ADD CONSTRAINT check_seats_positive
  CHECK (total_seats >= 1 AND extra_seats >= 0);

-- Create index for seat subscription code
CREATE INDEX IF NOT EXISTS idx_ws_sub_seat_subscription
  ON workspace_subscriptions(paystack_seat_subscription_code)
  WHERE paystack_seat_subscription_code IS NOT NULL;

-- Create index for tier filtering
CREATE INDEX IF NOT EXISTS idx_ws_sub_tier ON workspace_subscriptions(tier);

-- Create index for plan_catalog_id
CREATE INDEX IF NOT EXISTS idx_ws_sub_plan_catalog ON workspace_subscriptions(plan_catalog_id);

-- Migrate existing subscriptions to new structure
-- Map existing plan_slug to tier/billing_cycle
UPDATE workspace_subscriptions
SET
  tier = CASE
    WHEN plan_slug = 'starter' THEN 'free'
    WHEN plan_slug = 'pro' THEN 'pro'
    WHEN plan_slug = 'agency' THEN 'agency'
    ELSE 'free'
  END,
  billing_cycle = CASE
    WHEN status IN ('free', 'trialing') THEN 'none'
    WHEN status IN ('active', 'past_due') THEN 'monthly'
    ELSE 'none'
  END,
  total_seats = CASE
    WHEN plan_slug = 'pro' THEN 5
    WHEN plan_slug = 'agency' THEN 15
    ELSE 1
  END,
  extra_seats = 0
WHERE tier IS NULL OR tier = 'free';

-- Link to plan_catalog based on tier and billing_cycle
UPDATE workspace_subscriptions ws
SET plan_catalog_id = pc.id
FROM plan_catalog pc
WHERE
  ws.tier = pc.tier
  AND ws.billing_cycle = pc.billing_cycle
  AND ws.plan_catalog_id IS NULL;
