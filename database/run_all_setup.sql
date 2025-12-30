-- ============================================================
-- COMPLETE AUTO-SCRAPING SETUP
-- ============================================================
-- This script combines all setup, configuration, and verification
-- Run this entire script in Supabase Dashboard SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- STEP 2: CONFIGURE DATABASE SETTINGS
-- ============================================================
-- NOTE: Values are already set from configure_auto_scraping.sql
-- If you need to update them, uncomment and modify below:

ALTER DATABASE postgres SET app.supabase_url = 'https://ucbueapoexnxhttynfzy.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYnVlYXBvZXhueGh0dHluZnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0MzY5MiwiZXhwIjoyMDgyNDE5NjkyfQ.mhCinNZXETF2Ql0tPnoqdi4l9H-jlQRn23_b3yiF7ag';

-- ============================================================
-- STEP 3: CREATE TRIGGER FUNCTION
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
BEGIN
  -- Get Supabase URL and service role key from database settings
  BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
    service_role_key := NULL;
  END;
  
  -- Validate configuration
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE EXCEPTION 'Supabase URL not configured. Please set app.supabase_url database setting.';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Service role key not configured. Please set app.service_role_key database setting.';
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
-- STEP 4: SCHEDULE CRON JOB
-- ============================================================

-- Remove existing job if it exists (to allow re-running this script)
SELECT cron.unschedule('daily-auto-scrape') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-auto-scrape'
);

-- Schedule the job for 12:00 AM UTC daily
SELECT cron.schedule(
  'daily-auto-scrape',
  '0 0 * * *',
  $$SELECT trigger_scheduled_scraping();$$
);

-- ============================================================
-- STEP 5: CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_post_metrics_scraped_at 
ON public.post_metrics(scraped_at);

CREATE INDEX IF NOT EXISTS idx_post_metrics_post_id 
ON public.post_metrics(post_id);

CREATE INDEX IF NOT EXISTS idx_post_metrics_post_scraped 
ON public.post_metrics(post_id, scraped_at);

-- ============================================================
-- STEP 6: VERIFICATION
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-auto-scrape') THEN
    RAISE NOTICE '✅ Cron job "daily-auto-scrape" scheduled successfully';
  ELSE
    RAISE WARNING '❌ Cron job "daily-auto-scrape" was not created.';
  END IF;
END
$$;

-- Display the scheduled job
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'daily-auto-scrape';

-- Verify database settings
SELECT 
  name as setting_name,
  CASE 
    WHEN name = 'app.service_role_key' THEN '***HIDDEN***'
    ELSE setting
  END as value,
  CASE 
    WHEN setting IS NOT NULL AND setting != '' THEN '✅ Configured'
    ELSE '❌ Not Configured'
  END as status
FROM pg_settings
WHERE name IN ('app.supabase_url', 'app.service_role_key')
ORDER BY name;

-- Final summary
SELECT 
  CASE 
    WHEN (
      (SELECT COUNT(*) FROM pg_settings WHERE name = 'app.supabase_url' AND setting != '') = 1 AND
      (SELECT COUNT(*) FROM pg_settings WHERE name = 'app.service_role_key' AND setting != '') = 1 AND
      (SELECT COUNT(*) FROM pg_proc WHERE proname = 'trigger_scheduled_scraping') = 1 AND
      (SELECT COUNT(*) FROM cron.job WHERE jobname = 'daily-auto-scrape' AND active = true) = 1
    ) THEN '✅ All checks passed! Auto-scraping is configured correctly.'
    ELSE '❌ Some checks failed - review the results above.'
  END as overall_status;




