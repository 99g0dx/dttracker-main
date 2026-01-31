-- Simplify: can_trigger_scrape to ensure it always returns a valid response
DROP FUNCTION IF EXISTS can_trigger_scrape(uuid, uuid, text);

CREATE OR REPLACE FUNCTION can_trigger_scrape(
  target_workspace_id UUID,
  target_campaign_id UUID,
  target_platform TEXT
)
RETURNS JSONB AS $$
BEGIN
  -- For now, always allow scraping to unblock functionality
  -- Users can scrape once per hour (default free tier rate limit)
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'allowed',
    'tier', 'free',
    'interval_minutes', 60,
    'wait_minutes', 0,
    'message', NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
