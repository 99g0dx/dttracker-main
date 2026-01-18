-- ============================================================
-- AUTO-SCRAPING SETUP WITH pg_cron
-- ============================================================
-- This migration sets up automatic scraping every 12 hours
-- for all active posts in active campaigns.
--
-- SETUP INSTRUCTIONS:
-- 1. Run this script first: database/setup_auto_scraping.sql
-- 2. Then run: database/configure_auto_scraping.sql (update with your values)
-- 3. Verify setup: database/verify_auto_scraping.sql
--
-- Prerequisites:
-- 1. pg_cron extension must be enabled in your Supabase project
--    - Go to Database → Extensions → Search "pg_cron" → Enable
-- 2. SUPABASE_URL must be configured in app_settings
--    - Run configure_auto_scraping.sql after this script
--    - Optionally set a scrape trigger token
--
-- Configuration Options:
-- Option A (Recommended): Use app_settings table
--   - Run configure_auto_scraping.sql after this script
--   - Values stored in public.app_settings
-- ============================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension (for calling Edge Function)
CREATE EXTENSION IF NOT EXISTS http;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- FUNCTION: trigger_scheduled_scraping()
-- ============================================================
-- This function makes an HTTP request to the scrape-all-scheduled
-- Edge Function to trigger scheduled auto-scraping.
-- ============================================================

-- Settings table (non-sensitive values only)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_settings FROM PUBLIC;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION trigger_scheduled_scraping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  trigger_token TEXT;
  response_status INT;
  response_content TEXT;
  request_id INT;
BEGIN
  -- Get Supabase URL and optional trigger token from app_settings
  SELECT value INTO supabase_url
  FROM public.app_settings
  WHERE key = 'supabase_url';

  SELECT value INTO trigger_token
  FROM public.app_settings
  WHERE key = 'scrape_trigger_token';
  
  -- Validate configuration
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE EXCEPTION 'Supabase URL not configured. Please set app_settings.supabase_url.';
  END IF;

  -- Call the Edge Function via HTTP
  SELECT status, content INTO response_status, response_content
  FROM http((
    SELECT
      method := 'POST',
      url := supabase_url || '/functions/v1/scrape-all-scheduled',
      headers := (
        CASE
          WHEN trigger_token IS NOT NULL AND trigger_token <> '' THEN
            jsonb_build_object(
              'Content-Type', 'application/json',
              'x-scrape-trigger-token', trigger_token
            )
          ELSE
            jsonb_build_object('Content-Type', 'application/json')
        END
      ),
      body := '{}'::jsonb
    )::http_request
  ));

  -- Log the result
  RAISE NOTICE 'Scheduled scraping triggered at %', NOW();
  RAISE NOTICE 'Response Status: %', response_status;
  RAISE NOTICE 'Response Content: %', response_content;
  
  -- If there was an error, log it but don't fail (cron will retry next day)
  IF response_status != 200 THEN
    RAISE WARNING 'Scheduled scraping returned status %: %', response_status, response_content;
  END IF;
END;
$$;

-- ============================================================
-- SCHEDULE CRON JOB
-- ============================================================
-- Schedule the function to run every 12 hours
-- Cron expression: '0 */12 * * *' means:
-- - 0 minutes
-- - Every 12 hours
-- - Every day of month (*)
-- - Every month (*)
-- - Every day of week (*)
-- ============================================================

-- Remove existing job if it exists (to allow re-running this migration)
SELECT cron.unschedule('daily-auto-scrape') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-auto-scrape'
);

-- Schedule the job
SELECT cron.schedule(
  'daily-auto-scrape',                    -- Job name
  '0 */12 * * *',                         -- Cron expression (every 12 hours)
  $$SELECT trigger_scheduled_scraping();$$ -- SQL to execute
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
-- Add indexes on post_metrics table for faster time-series queries
-- ============================================================

-- Index on scraped_at for time-series queries
CREATE INDEX IF NOT EXISTS idx_post_metrics_scraped_at 
ON public.post_metrics(scraped_at);

-- Index on post_id for lookups
CREATE INDEX IF NOT EXISTS idx_post_metrics_post_id 
ON public.post_metrics(post_id);

-- Composite index for efficient campaign time-series queries
-- This helps when querying by post_id and date range
CREATE INDEX IF NOT EXISTS idx_post_metrics_post_scraped 
ON public.post_metrics(post_id, scraped_at);

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Verify the schedule was created
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-auto-scrape') THEN
    RAISE NOTICE '✅ Cron job "daily-auto-scrape" scheduled successfully';
    RAISE NOTICE '   Next run: Check cron.job_run_details table after first execution';
  ELSE
    RAISE WARNING '❌ Cron job "daily-auto-scrape" was not created. Check pg_cron extension.';
  END IF;
END
$$;

-- Display the scheduled job
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'daily-auto-scrape';
