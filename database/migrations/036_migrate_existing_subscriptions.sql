-- Migration: Migrate existing subscriptions to new tier structure
-- Description: Update existing workspace_subscriptions to use new plan_catalog

-- First, ensure all workspaces have a subscription record
INSERT INTO workspace_subscriptions (workspace_id, plan_slug, status, tier, billing_cycle, total_seats)
SELECT
  p.id,
  'starter',
  'free',
  'free',
  'none',
  1
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_subscriptions ws WHERE ws.workspace_id = p.id
)
ON CONFLICT (workspace_id) DO NOTHING;

-- Update existing subscriptions that don't have tier set
UPDATE workspace_subscriptions ws
SET
  tier = CASE
    WHEN ws.plan_slug = 'starter' AND ws.status = 'free' THEN 'free'
    WHEN ws.plan_slug = 'starter' THEN 'starter'
    WHEN ws.plan_slug = 'pro' THEN 'pro'
    WHEN ws.plan_slug = 'agency' THEN 'agency'
    ELSE 'free'
  END,
  billing_cycle = CASE
    WHEN ws.status IN ('free') THEN 'none'
    WHEN ws.status IN ('trialing', 'active', 'past_due') THEN 'monthly'
    ELSE 'none'
  END,
  total_seats = CASE
    WHEN ws.plan_slug = 'agency' THEN 15
    WHEN ws.plan_slug = 'pro' THEN 5
    WHEN ws.plan_slug = 'starter' AND ws.status != 'free' THEN 1
    ELSE 1
  END,
  extra_seats = 0
WHERE ws.tier IS NULL OR ws.tier = '';

-- Link all subscriptions to their corresponding plan_catalog entry
UPDATE workspace_subscriptions ws
SET plan_catalog_id = (
  SELECT pc.id
  FROM plan_catalog pc
  WHERE pc.tier = ws.tier
    AND pc.billing_cycle = ws.billing_cycle
  LIMIT 1
)
WHERE ws.plan_catalog_id IS NULL;

-- Initialize usage counters for any workspaces that don't have them
INSERT INTO usage_counters (workspace_id, active_campaigns_count, total_creators_count, active_team_members_count)
SELECT
  ws.workspace_id,
  COALESCE((SELECT COUNT(*) FROM campaigns c WHERE c.workspace_id = ws.workspace_id AND c.deleted_at IS NULL), 0),
  COALESCE((SELECT COUNT(*) FROM workspace_creators wc WHERE wc.workspace_id = ws.workspace_id), 0),
  COALESCE((SELECT COUNT(*) FROM team_members tm WHERE tm.workspace_id = ws.workspace_id AND tm.status = 'active'), 0) + 1
FROM workspace_subscriptions ws
WHERE NOT EXISTS (
  SELECT 1 FROM usage_counters uc WHERE uc.workspace_id = ws.workspace_id
)
ON CONFLICT (workspace_id) DO NOTHING;

-- Update plan_slug to match new tier_billing_cycle format for consistency
UPDATE workspace_subscriptions ws
SET plan_slug = CASE
  WHEN ws.tier = 'free' THEN 'free'
  WHEN ws.billing_cycle = 'yearly' THEN ws.tier || '_yearly'
  ELSE ws.tier || '_monthly'
END
WHERE ws.plan_slug NOT LIKE '%_monthly' AND ws.plan_slug NOT LIKE '%_yearly' AND ws.plan_slug != 'free';
