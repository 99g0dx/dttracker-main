-- Migration: Adjust enqueue-scrape-jobs cron frequency
-- Description: Run scrape-all-scheduled every 30 minutes instead of every 12 hours

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enqueue-scrape-jobs') THEN
    PERFORM cron.unschedule('enqueue-scrape-jobs');
  END IF;
END $$;

SELECT cron.schedule(
  'enqueue-scrape-jobs',
  '*/30 * * * *',
  $$SELECT trigger_scheduled_scraping();$$
);

