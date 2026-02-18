-- Migration: Remove scheduled scraping (cron jobs and trigger functions)
-- Description: Unschedule enqueue-scrape-jobs and process-scrape-jobs,
--              and drop trigger_scheduled_scraping() and trigger_scrape_job_worker().
--              Manual and on-demand scraping (e.g. from UI) is unchanged.

-- Unschedule cron jobs (ignore if already removed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-scrape-jobs') THEN
    PERFORM cron.unschedule('enqueue-scrape-jobs');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scrape-jobs') THEN
    PERFORM cron.unschedule('process-scrape-jobs');
  END IF;
END
$$;

-- Drop trigger functions (no longer needed)
DROP FUNCTION IF EXISTS trigger_scheduled_scraping();
DROP FUNCTION IF EXISTS trigger_scrape_job_worker();
