-- Sound metadata on posts (extracted from Apify at scrape time)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS sound_id TEXT,
  ADD COLUMN IF NOT EXISTS sound_name TEXT,
  ADD COLUMN IF NOT EXISTS sound_artist TEXT,
  ADD COLUMN IF NOT EXISTS sound_platform_url TEXT,
  ADD COLUMN IF NOT EXISTS sound_cover_url TEXT,
  ADD COLUMN IF NOT EXISTS sound_usage_count INTEGER,
  ADD COLUMN IF NOT EXISTS sound_raw_meta JSONB,
  ADD COLUMN IF NOT EXISTS sound_last_enriched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_sound_id ON posts(sound_id) WHERE sound_id IS NOT NULL;

-- Campaign-level sound performance aggregation view
CREATE OR REPLACE VIEW campaign_sound_performance AS
SELECT
  p.campaign_id,
  p.sound_id,
  p.sound_name,
  p.sound_artist,
  p.platform,
  COUNT(*) AS post_count,
  SUM(p.views) AS total_views,
  ROUND(AVG(p.views)) AS avg_views,
  SUM(p.likes) AS total_likes,
  ROUND(AVG(p.engagement_rate), 2) AS avg_engagement_rate,
  MIN(p.posted_date) AS earliest_post,
  MAX(p.posted_date) AS latest_post
FROM posts p
WHERE p.sound_id IS NOT NULL AND p.status = 'scraped'
GROUP BY p.campaign_id, p.sound_id, p.sound_name, p.sound_artist, p.platform;
