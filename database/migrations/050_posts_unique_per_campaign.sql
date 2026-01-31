-- Ensure posts deduplication is scoped per campaign
ALTER TABLE public.posts
  ALTER COLUMN campaign_id SET NOT NULL;

DROP INDEX IF EXISTS idx_posts_platform_external_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_campaign_platform_external_id
  ON public.posts (campaign_id, platform, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_external_id
  ON public.posts (external_id)
  WHERE external_id IS NOT NULL;
