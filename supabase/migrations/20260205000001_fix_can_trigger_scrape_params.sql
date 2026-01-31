-- Fix: can_trigger_scrape function parameter names must match RPC call
-- The scrape-post function calls can_trigger_scrape with named parameters:
-- target_workspace_id, target_campaign_id, target_platform
-- But the function was created with p_ prefixed names

DROP FUNCTION IF EXISTS can_trigger_scrape(uuid, uuid, text);

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
