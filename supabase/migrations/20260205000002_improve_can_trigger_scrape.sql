-- Improve: can_trigger_scrape function to return reason field and handle missing subscriptions
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

  -- If no subscription found, allow scraping anyway (for free tier or development)
  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_status := 'active';
    v_limits := jsonb_build_object(
      'scrape_interval_minutes', 60,
      'platforms', jsonb_object(ARRAY['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'])
    );
  END IF;

  -- Check for expired trial
  IF v_status = 'trialing' AND v_trial_end < now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'trial_expired',
      'tier', v_tier,
      'message', 'Your 14-day Pro trial has expired. Please upgrade to refresh data.'
    );
  END IF;

  -- If subscription status is not active or trialing, deny
  IF v_status NOT IN ('active', 'trialing') AND v_status IS NOT NULL THEN
     RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'subscription_not_active',
      'tier', v_tier,
      'message', 'Subscription required.'
    );
  END IF;

  -- Check if platform is allowed
  v_platforms := v_limits->'platforms';
  IF v_platforms IS NOT NULL AND NOT v_platforms ? target_platform THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'platform_not_allowed',
      'tier', v_tier,
      'message', format('Platform %s is not available on your plan. Upgrade to access more platforms.', target_platform)
    );
  END IF;

  -- Get scrape interval (default 60 minutes for free tier)
  v_interval_minutes := COALESCE((v_limits->>'scrape_interval_minutes')::INTEGER, 60);

  -- Check if scrape is allowed based on interval
  SELECT * INTO v_scrape_result
  FROM can_scrape_platform(target_campaign_id, target_platform, v_interval_minutes);

  IF v_scrape_result.allowed THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'allowed',
      'tier', v_tier,
      'interval_minutes', v_interval_minutes,
      'message', NULL
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'scrape_interval_not_met',
      'wait_minutes', v_scrape_result.wait_minutes,
      'tier', v_tier,
      'interval_minutes', v_interval_minutes,
      'last_scraped_at', v_scrape_result.last_scraped,
      'message', format('Please wait %s minutes before scraping again. Your plan allows scraping every %s minutes.', v_scrape_result.wait_minutes, v_interval_minutes)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
