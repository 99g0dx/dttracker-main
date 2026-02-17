-- Migration: Create claim_scrape_jobs RPC for atomic job claiming
-- Description: Atomically claims jobs from the queue using FOR UPDATE SKIP LOCKED
--              to prevent race conditions when multiple workers run concurrently

CREATE OR REPLACE FUNCTION claim_scrape_jobs(p_limit INT DEFAULT 10)
RETURNS SETOF scrape_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE scrape_jobs
  SET status = 'running', updated_at = now()
  WHERE id IN (
    SELECT id FROM scrape_jobs
    WHERE status IN ('queued', 'cooldown')
      AND scheduled_for <= now()
      AND attempts < max_attempts
    ORDER BY priority DESC, scheduled_for ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
