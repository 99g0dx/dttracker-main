-- RPC for Scrape Ops admin: retry failed scrape jobs (called by company admins from UI).
-- RLS does not allow UPDATE on scrape_jobs from client; this runs with definer rights.
CREATE OR REPLACE FUNCTION public.retry_failed_scrape_jobs(p_job_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.scrape_jobs
  SET
    status = 'queued',
    attempts = 0,
    scheduled_for = now(),
    next_retry_at = null,
    last_error = null,
    last_actor_id = null,
    updated_at = now()
  WHERE id = ANY(p_job_ids)
    AND status = 'failed';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_scrape_jobs(uuid[]) TO authenticated;
