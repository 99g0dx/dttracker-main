-- Migration: Create campaign_platform_scrapes table
-- Description: Track last scrape time per campaign per platform for rate limiting

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
