-- Migration: Add scrape observability and dead letter queue
-- Description: Creates views and RPCs for monitoring scrape queue health,
--              and a dead letter queue for permanently failed jobs

-- ============================================================
-- DEAD LETTER QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scrape_jobs_dead (
  LIKE public.scrape_jobs INCLUDING ALL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolution TEXT CHECK (resolution IN ('manual_retry', 'abandoned', 'max_attempts_exceeded'))
);

-- Index for querying dead jobs
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_dead_moved_at ON public.scrape_jobs_dead(moved_at);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_dead_reference ON public.scrape_jobs_dead(reference_type, reference_id);

-- RLS for dead letter queue (same as main queue)
ALTER TABLE public.scrape_jobs_dead ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read scrape_jobs_dead" ON public.scrape_jobs_dead;
CREATE POLICY "Allow read scrape_jobs_dead" ON public.scrape_jobs_dead FOR SELECT USING (true);

-- ============================================================
-- OBSERVABILITY VIEWS
-- ============================================================

CREATE OR REPLACE VIEW scrape_queue_health AS
SELECT
  status,
  COUNT(*) as count,
  MIN(scheduled_for) as oldest_job,
  AVG(attempts)::numeric(10,2) as avg_attempts,
  MAX(attempts) as max_attempts
FROM scrape_jobs
WHERE status NOT IN ('success')
GROUP BY status;

-- ============================================================
-- PER-WORKSPACE SCRAPE HEALTH RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_scrape_health(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_posts INTEGER;
  v_pending_scrapes INTEGER;
  v_failed_scrapes INTEGER;
  v_last_scrape TIMESTAMPTZ;
  v_avg_scrape_age_hours NUMERIC;
BEGIN
  -- Count total posts for this workspace
  SELECT COUNT(*) INTO v_total_posts
  FROM posts p
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.workspace_id = p_workspace_id;

  -- Count pending scrape jobs
  SELECT COUNT(*) INTO v_pending_scrapes
  FROM scrape_jobs sj
  JOIN posts p ON p.id = sj.reference_id AND sj.reference_type = 'post'
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.workspace_id = p_workspace_id
    AND sj.status = 'queued';

  -- Count failed scrape jobs
  SELECT COUNT(*) INTO v_failed_scrapes
  FROM scrape_jobs sj
  JOIN posts p ON p.id = sj.reference_id AND sj.reference_type = 'post'
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.workspace_id = p_workspace_id
    AND sj.status = 'failed';

  -- Get most recent scrape time
  SELECT MAX(p.last_scraped_at) INTO v_last_scrape
  FROM posts p
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.workspace_id = p_workspace_id
    AND p.last_scraped_at IS NOT NULL;

  -- Calculate average scrape age in hours
  SELECT AVG(EXTRACT(EPOCH FROM (now() - p.last_scraped_at)) / 3600)::numeric(10,2)
  INTO v_avg_scrape_age_hours
  FROM posts p
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.workspace_id = p_workspace_id
    AND p.last_scraped_at IS NOT NULL;

  RETURN jsonb_build_object(
    'total_posts', COALESCE(v_total_posts, 0),
    'pending_scrapes', COALESCE(v_pending_scrapes, 0),
    'failed_scrapes', COALESCE(v_failed_scrapes, 0),
    'last_scrape', v_last_scrape,
    'avg_scrape_age_hours', COALESCE(v_avg_scrape_age_hours, 0)
  );
END;
$$;
