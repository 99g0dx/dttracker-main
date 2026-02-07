-- Add run validity fields to scrape_runs
ALTER TABLE public.scrape_runs
  ADD COLUMN IF NOT EXISTS error_type TEXT CHECK (error_type IN ('blocked', 'challenge', 'empty', 'timeout', 'parse_error', 'unknown')),
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT false;

-- Add per-post scrape tracking fields to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_status TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_error TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_items_count INT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_metrics JSONB;

-- Backfill: for posts that already have last_scraped_at and status='scraped', set last_success_at
UPDATE public.posts
SET last_success_at = last_scraped_at
WHERE last_scraped_at IS NOT NULL
  AND status IN ('scraped', 'manual')
  AND last_success_at IS NULL;

-- Index for UI queries on post freshness
CREATE INDEX IF NOT EXISTS idx_posts_last_success ON public.posts(last_success_at)
  WHERE last_success_at IS NOT NULL;
