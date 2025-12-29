-- ============================================================
-- AUTO-SCRAPING SETUP WITH pg_cron
-- ============================================================
-- This migration sets up automatic daily scraping at 12:00 AM UTC
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
-- 2. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured
--    - Run configure_auto_scraping.sql after this script
--    - OR hardcode values in the function below (lines 60-63)
--
-- Configuration Options:
-- Option A (Recommended): Use database settings
--   - Run configure_auto_scraping.sql after this script
--   - Values stored securely in database settings
--
-- Option B (Alternative): Hardcode in function
--   - Uncomment lines 62-63 and update with your values
--   - Comment out the database settings section (lines 51-58)
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
-- Edge Function to trigger daily auto-scraping.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_scheduled_scraping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  response_status INT;
  response_content TEXT;
  request_id INT;
BEGIN
  -- Get Supabase URL and service role key from database settings
  -- These should be set using: ALTER DATABASE postgres SET app.supabase_url = 'https://...';
  -- OR hardcode them below (less secure but simpler)
  
  -- Option 1: Get from database settings (recommended)
  BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Settings not found, will use defaults below
    supabase_url := NULL;
    service_role_key := NULL;
  END;
  
  -- Option 2: Hardcode values (replace with your actual values)
  -- Uncomment and update these lines if you prefer hardcoding:
  -- supabase_url := 'https://your-project.supabase.co';
  -- service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  
  -- Validate configuration
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE EXCEPTION 'Supabase URL not configured. Please set app.supabase_url database setting or hardcode in function.';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Service role key not configured. Please set app.service_role_key database setting or hardcode in function.';
  END IF;

  -- Call the Edge Function via HTTP
  SELECT status, content INTO response_status, response_content
  FROM http((
    SELECT
      method := 'POST',
      url := supabase_url || '/functions/v1/scrape-all-scheduled',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
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
-- Schedule the function to run daily at 12:00 AM UTC
-- Cron expression: '0 0 * * *' means:
-- - 0 minutes
-- - 0 hours (midnight)
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
  '0 0 * * *',                            -- Cron expression (12:00 AM UTC daily)
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

