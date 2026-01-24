-- Add external_id and owner_username to posts for scraper metadata
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_username TEXT;

-- Allow posts without an attached creator until scraping resolves a match
ALTER TABLE public.posts
  ALTER COLUMN creator_id DROP NOT NULL;

-- Prevent duplicate posts per platform + external ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_platform_external_id
  ON public.posts(platform, external_id)
  WHERE external_id IS NOT NULL;
