-- Add validity tracking to scrape_runs and per-post scrape tracking fields
-- This enables Chartmetric-level stability: only update posts when scrape is valid,
-- track last success vs last attempt, and prevent overwriting with zeros

-- ============================================================
-- 1. Add error_type and is_valid to scrape_runs
-- ============================================================
ALTER TABLE public.scrape_runs
  ADD COLUMN IF NOT EXISTS error_type TEXT CHECK (error_type IN ('blocked', 'challenge', 'empty', 'timeout', 'unknown', NULL)),
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scrape_runs_validity
  ON public.scrape_runs(job_id, is_valid, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_error_type
  ON public.scrape_runs(error_type, finished_at DESC)
  WHERE error_type IS NOT NULL;

-- ============================================================
-- 2. Add per-post scrape tracking fields
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_status TEXT CHECK (last_attempt_status IN ('started', 'succeeded', 'failed', 'timed_out', NULL)),
  ADD COLUMN IF NOT EXISTS last_attempt_error TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_items_count INT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metrics JSONB; -- Last valid metrics snapshot: {views, likes, comments, shares, engagement_rate}

-- Indexes for per-post tracking
CREATE INDEX IF NOT EXISTS idx_posts_last_success_at
  ON public.posts(last_success_at DESC)
  WHERE last_success_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_next_retry_at
  ON public.posts(next_retry_at)
  WHERE next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_cooldown_until
  ON public.posts(cooldown_until)
  WHERE cooldown_until IS NOT NULL;

-- Backfill: set last_success_at from last_scraped_at for existing scraped posts
UPDATE public.posts
SET last_success_at = last_scraped_at
WHERE last_scraped_at IS NOT NULL
  AND (last_success_at IS NULL OR last_success_at < last_scraped_at)
  AND status IN ('scraped', 'manual');

-- Backfill: set metrics JSONB from current columns for existing posts
UPDATE public.posts
SET metrics = jsonb_build_object(
  'views', COALESCE(views, 0),
  'likes', COALESCE(likes, 0),
  'comments', COALESCE(comments, 0),
  'shares', COALESCE(shares, 0),
  'engagement_rate', COALESCE(engagement_rate, 0)
)
WHERE metrics IS NULL
  AND (views IS NOT NULL OR likes IS NOT NULL OR comments IS NOT NULL OR shares IS NOT NULL);
