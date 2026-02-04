-- Migration: Create campaign_platform_scrapes table and enforcement RPC functions
-- Description: Track last scrape time per campaign per platform and implement scrape rate limiting

-- Create campaign_platform_scrapes table
CREATE TABLE IF NOT EXISTS campaign_platform_scrapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  platform TEXT NOT NULL,
  last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scrape_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one record per campaign/platform combo
  UNIQUE(campaign_id, platform)
);

-- Add foreign key if campaigns table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    ALTER TABLE campaign_platform_scrapes
      DROP CONSTRAINT IF EXISTS fk_campaign_platform_scrapes_campaign;
    ALTER TABLE campaign_platform_scrapes
      ADD CONSTRAINT fk_campaign_platform_scrapes_campaign
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cps_campaign ON campaign_platform_scrapes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cps_platform ON campaign_platform_scrapes(platform);
CREATE INDEX IF NOT EXISTS idx_cps_last_scraped ON campaign_platform_scrapes(last_scraped_at);
CREATE INDEX IF NOT EXISTS idx_cps_campaign_platform ON campaign_platform_scrapes(campaign_id, platform);

-- Enable RLS
ALTER TABLE campaign_platform_scrapes ENABLE ROW LEVEL SECURITY;

-- Users can view scrape info for their own campaigns
DROP POLICY IF EXISTS "Users can view own campaign scrapes" ON campaign_platform_scrapes;
CREATE POLICY "Users can view own campaign scrapes"
  ON campaign_platform_scrapes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_platform_scrapes.campaign_id
        AND c.workspace_id = auth.uid()
    )
  );

-- Function to update or insert scrape record
CREATE OR REPLACE FUNCTION record_platform_scrape(
  p_campaign_id UUID,
  p_platform TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO campaign_platform_scrapes (campaign_id, platform, last_scraped_at, scrape_count)
  VALUES (p_campaign_id, p_platform, now(), 1)
  ON CONFLICT (campaign_id, platform)
  DO UPDATE SET
    last_scraped_at = now(),
    scrape_count = campaign_platform_scrapes.scrape_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if scrape is allowed based on interval
CREATE OR REPLACE FUNCTION can_scrape_platform(
  p_campaign_id UUID,
  p_platform TEXT,
  p_interval_minutes INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  wait_minutes INTEGER,
  last_scraped TIMESTAMPTZ
) AS $$
DECLARE
  v_last_scraped TIMESTAMPTZ;
  v_minutes_since_scrape INTEGER;
BEGIN
  -- Get last scrape time
  SELECT cps.last_scraped_at INTO v_last_scraped
  FROM campaign_platform_scrapes cps
  WHERE cps.campaign_id = p_campaign_id AND cps.platform = p_platform;

  -- If never scraped, allow
  IF v_last_scraped IS NULL THEN
    RETURN QUERY SELECT true, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Calculate minutes since last scrape
  v_minutes_since_scrape := EXTRACT(EPOCH FROM (now() - v_last_scraped)) / 60;

  -- Check if enough time has passed
  IF v_minutes_since_scrape >= p_interval_minutes THEN
    RETURN QUERY SELECT true, 0, v_last_scraped;
  ELSE
    RETURN QUERY SELECT false, p_interval_minutes - v_minutes_since_scrape, v_last_scraped;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforcement RPC Functions
-- Function: can_create_campaign
-- Checks if workspace can create a new campaign based on plan limits
CREATE OR REPLACE FUNCTION can_create_campaign(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
  v_status TEXT;
  v_trial_end TIMESTAMPTZ;
  v_limits JSONB;
BEGIN
  -- Get current campaign count
  SELECT COALESCE(active_campaigns_count, 0) INTO v_current_count
  FROM usage_counters
  WHERE workspace_id = p_workspace_id;

  -- If no counter exists, count is 0
  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  -- Get subscription tier and limits
  SELECT
    pc.tier,
    ws.status,
    ws.trial_end_at,
    pc.limits_json
  INTO v_tier, v_status, v_trial_end, v_limits
  FROM workspace_subscriptions ws
  LEFT JOIN plan_catalog pc ON ws.plan_slug = pc.slug
  WHERE ws.workspace_id = p_workspace_id;

  -- Check for expired trial (Strict Enforcement)
  IF v_status = 'trialing' AND v_trial_end < now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 0,
      'current', v_current_count,
      'tier', v_tier,
      'message', 'Your 14-day Pro trial has expired. Please upgrade to create more campaigns.'
    );
  END IF;

  -- If no subscription found or status is not active/trialing
  IF v_tier IS NULL OR (v_status NOT IN ('active', 'trialing') AND v_status IS NOT NULL) THEN
     RETURN jsonb_build_object(
      'allowed', false,
      'limit', 0,
      'current', v_current_count,
      'tier', 'expired',
      'message', 'Subscription required. Please upgrade your plan.'
    );
  END IF;

  -- Get campaign limit (-1 = unlimited)
  v_limit := COALESCE((v_limits->>'campaigns')::INTEGER, 1);

  -- Check if unlimited
  IF v_limit = -1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', -1,
      'current', v_current_count,
      'tier', v_tier,
      'message', NULL
    );
  END IF;

  -- Check if within limit
  IF v_current_count < v_limit THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', v_limit,
      'current', v_current_count,
      'tier', v_tier,
      'message', NULL
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', v_limit,
      'current', v_current_count,
      'tier', v_tier,
      'message', format('You have reached your campaign limit of %s. Upgrade to create more campaigns.', v_limit)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: can_add_creator
-- Checks if a creator can be added to a campaign based on plan limits
CREATE OR REPLACE FUNCTION can_add_creator(
  p_workspace_id UUID,
  p_campaign_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
  v_status TEXT;
  v_trial_end TIMESTAMPTZ;
  v_limits JSONB;
BEGIN
  -- Get current creator count for this campaign
  SELECT COUNT(*) INTO v_current_count
  FROM campaign_creators
  WHERE campaign_id = p_campaign_id;

  -- Get subscription tier and limits
  SELECT
    pc.tier,
    ws.status,
    ws.trial_end_at,
    pc.limits_json
  INTO v_tier, v_status, v_trial_end, v_limits
  FROM workspace_subscriptions ws
  LEFT JOIN plan_catalog pc ON ws.plan_slug = pc.slug
  WHERE ws.workspace_id = p_workspace_id;

  -- Check for expired trial
  IF v_status = 'trialing' AND v_trial_end < now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 0,
      'current', v_current_count,
      'tier', v_tier,
      'message', 'Your 14-day Pro trial has expired. Please upgrade to add more creators.'
    );
  END IF;

  -- If no valid subscription
  IF v_tier IS NULL OR (v_status NOT IN ('active', 'trialing') AND v_status IS NOT NULL) THEN
     RETURN jsonb_build_object(
      'allowed', false,
      'limit', 0,
      'current', v_current_count,
      'tier', 'expired',
      'message', 'Subscription required.'
    );
  END IF;

  -- Get creators per campaign limit (-1 = unlimited)
  v_limit := COALESCE((v_limits->>'creators_per_campaign')::INTEGER, 10);

  -- Check if unlimited
  IF v_limit = -1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', -1,
      'current', v_current_count,
      'tier', v_tier,
      'message', NULL
    );
  END IF;

  -- Check if within limit
  IF v_current_count < v_limit THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', v_limit,
      'current', v_current_count,
      'tier', v_tier,
      'message', NULL
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', v_limit,
      'current', v_current_count,
      'tier', v_tier,
      'message', format('You have reached your creator limit of %s per campaign. Upgrade to add more creators.', v_limit)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: can_trigger_scrape
-- Checks if a scrape can be triggered based on plan scrape interval
-- Parameter names must match RPC call: target_workspace_id, target_campaign_id, target_platform
CREATE OR REPLACE FUNCTION can_trigger_scrape(
  target_workspace_id UUID,
  target_campaign_id UUID,
  target_platform TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_interval_minutes INTEGER;
  v_tier TEXT;
  v_status TEXT;
  v_trial_end TIMESTAMPTZ;
  v_limits JSONB;
  v_platforms JSONB;
  v_scrape_result RECORD;
BEGIN
  -- Get subscription tier and limits
  SELECT
    pc.tier,
    ws.status,
    ws.trial_end_at,
    pc.limits_json
  INTO v_tier, v_status, v_trial_end, v_limits
  FROM workspace_subscriptions ws
  LEFT JOIN plan_catalog pc ON ws.plan_slug = pc.slug
  WHERE ws.workspace_id = target_workspace_id;

  -- Check for expired trial
  IF v_status = 'trialing' AND v_trial_end < now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'wait_minutes', 0,
      'tier', v_tier,
      'message', 'Your 14-day Pro trial has expired. Please upgrade to refresh data.'
    );
  END IF;

  -- If no valid subscription
  IF v_tier IS NULL OR (v_status NOT IN ('active', 'trialing') AND v_status IS NOT NULL) THEN
     RETURN jsonb_build_object(
      'allowed', false,
      'wait_minutes', 0,
      'tier', 'expired',
      'message', 'Subscription required.'
    );
  END IF;

  -- Check if platform is allowed
  v_platforms := v_limits->'platforms';
  IF v_platforms IS NOT NULL AND NOT v_platforms ? target_platform THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'wait_minutes', 0,
      'tier', v_tier,
      'message', format('Platform %s is not available on your plan. Upgrade to access more platforms.', target_platform)
    );
  END IF;

  -- Get scrape interval
  v_interval_minutes := COALESCE((v_limits->>'scrape_interval_minutes')::INTEGER, 2880);

  -- Check if scrape is allowed based on interval
  SELECT * INTO v_scrape_result
  FROM can_scrape_platform(target_campaign_id, target_platform, v_interval_minutes);

  IF v_scrape_result.allowed THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'wait_minutes', 0,
      'tier', v_tier,
      'interval_minutes', v_interval_minutes,
      'message', NULL
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'wait_minutes', v_scrape_result.wait_minutes,
      'tier', v_tier,
      'interval_minutes', v_interval_minutes,
      'last_scraped_at', v_scrape_result.last_scraped,
      'message', format('Please wait %s minutes before scraping again. Your plan allows scraping every %s minutes.', v_scrape_result.wait_minutes, v_interval_minutes)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: can_add_team_member
-- Checks if a team member can be added based on seat limits
CREATE OR REPLACE FUNCTION can_add_team_member(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_count INTEGER;
  v_total_seats INTEGER;
  v_tier TEXT;
  v_status TEXT;
  v_trial_end TIMESTAMPTZ;
BEGIN
  -- Get current team member count directly from table
  SELECT COUNT(*) INTO v_current_count
  FROM team_members
  WHERE workspace_id = p_workspace_id;

  IF v_current_count < 1 THEN
    v_current_count := 1; -- At least the owner
  END IF;

  -- Get subscription tier and total seats
  SELECT
    pc.tier,
    ws.status,
    ws.trial_end_at,
    ws.total_seats
  INTO v_tier, v_status, v_trial_end, v_total_seats
  FROM workspace_subscriptions ws
  LEFT JOIN plan_catalog pc ON ws.plan_slug = pc.slug
  WHERE ws.workspace_id = p_workspace_id;

  -- Check for expired trial
  IF v_status = 'trialing' AND v_trial_end < now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', 1,
      'current', v_current_count,
      'tier', v_tier,
      'message', 'Your 14-day Pro trial has expired. Please upgrade to add team members.'
    );
  END IF;

  -- If no valid subscription
  IF v_tier IS NULL OR (v_status NOT IN ('active', 'trialing') AND v_status IS NOT NULL) THEN
    v_tier := 'expired';
    v_total_seats := 1; -- Allow owner only
  END IF;

  -- Check if within seat limit
  IF v_current_count < v_total_seats THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', v_total_seats,
      'current', v_current_count,
      'tier', v_tier,
      'message', NULL
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', v_total_seats,
      'current', v_current_count,
      'tier', v_tier,
      'message', format('You have used all %s seats. Add more seats or upgrade your plan.', v_total_seats)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_workspace_usage
-- Returns complete usage and limits for a workspace
CREATE OR REPLACE FUNCTION get_workspace_usage(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_usage RECORD;
  v_sub RECORD;
  v_limits JSONB;
  v_creators_count INTEGER;
  v_team_count INTEGER;
BEGIN
  -- Get usage counters
  SELECT * INTO v_usage
  FROM usage_counters
  WHERE workspace_id = p_workspace_id;

  -- Calculate total creators count directly (since usage_counters might lack the column)
  SELECT COUNT(*) INTO v_creators_count
  FROM campaign_creators cc
  JOIN campaigns c ON c.id = cc.campaign_id
  WHERE c.workspace_id = p_workspace_id;

  -- Calculate team members count directly
  SELECT COUNT(*) INTO v_team_count
  FROM team_members
  WHERE workspace_id = p_workspace_id;

  IF v_team_count < 1 THEN
    v_team_count := 1;
  END IF;

  -- Get subscription and plan info
  SELECT
    pc.tier,
    pc.billing_cycle,
    ws.total_seats,
    ws.extra_seats,
    ws.status,
    pc.limits_json,
    pc.features_json
  INTO v_sub
  FROM workspace_subscriptions ws
  LEFT JOIN plan_catalog pc ON ws.plan_slug = pc.slug
  WHERE ws.workspace_id = p_workspace_id;

  -- Default values if no data found
  IF v_sub IS NULL THEN
    v_sub.tier := 'expired';
    v_sub.billing_cycle := 'none';
    v_sub.total_seats := 1;
    v_sub.extra_seats := 0;
    v_sub.status := 'expired';
    v_sub.limits_json := '{}'::jsonb;
    v_sub.features_json := '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'tier', v_sub.tier,
    'billing_cycle', v_sub.billing_cycle,
    'status', v_sub.status,
    'usage', jsonb_build_object(
      'campaigns', COALESCE(v_usage.active_campaigns_count, 0),
      'creators', COALESCE(v_creators_count, 0),
      'team_members', v_team_count
    ),
    'limits', v_sub.limits_json,
    'features', v_sub.features_json,
    'seats', jsonb_build_object(
      'total', v_sub.total_seats,
      'extra', v_sub.extra_seats,
      'used', v_team_count
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
