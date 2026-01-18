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
-- Store non-sensitive config in a settings table (avoid ALTER DATABASE permissions).

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Restrict access to settings table
REVOKE ALL ON public.app_settings FROM PUBLIC;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- Update Supabase URL (safe to store)
INSERT INTO public.app_settings(key, value)
VALUES ('supabase_url', 'https://ucbueapoexnxhttynfzy.supabase.co')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- Optional: token used by the cron trigger to call the Edge Function
-- Replace the value below with a random secret and set the same value
-- in the Edge Function env var SCRAPE_TRIGGER_TOKEN.
INSERT INTO public.app_settings(key, value)
VALUES ('scrape_trigger_token', 'CHANGE_ME')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

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
  trigger_token TEXT;
  response_status INT;
  response_content TEXT;
BEGIN
  -- Get Supabase URL and optional trigger token from settings table
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
          WHEN trigger_token IS NOT NULL AND trigger_token <> '' AND trigger_token <> 'CHANGE_ME' THEN
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
-- STEP 4: SCHEDULE CRON JOB
-- ============================================================

-- Remove existing job if it exists (to allow re-running this script)
SELECT cron.unschedule('daily-auto-scrape') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-auto-scrape'
);

-- Schedule the job every 12 hours
SELECT cron.schedule(
  'daily-auto-scrape',
  '0 */12 * * *',
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
  key as setting_name,
  CASE 
    WHEN key = 'scrape_trigger_token' THEN '***HIDDEN***'
    ELSE value
  END as value,
  CASE 
    WHEN value IS NOT NULL AND value != '' THEN '✅ Configured'
    ELSE '❌ Not Configured'
  END as status
FROM public.app_settings
WHERE key IN ('supabase_url', 'scrape_trigger_token')
ORDER BY key;

-- Final summary
SELECT 
  CASE 
    WHEN (
      (SELECT COUNT(*) FROM public.app_settings WHERE key = 'supabase_url' AND value != '') = 1 AND
      (SELECT COUNT(*) FROM pg_proc WHERE proname = 'trigger_scheduled_scraping') = 1 AND
      (SELECT COUNT(*) FROM cron.job WHERE jobname = 'daily-auto-scrape' AND active = true) = 1
    ) THEN '✅ All checks passed! Auto-scraping is configured correctly.'
    ELSE '❌ Some checks failed - review the results above.'
  END as overall_status;


