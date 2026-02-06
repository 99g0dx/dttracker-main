-- Setup cron jobs for automatic scraping
-- This sets up two cron jobs:
-- 1. scrape-all-scheduled: Enqueues due posts into scrape_jobs (runs every 12 hours)
-- 2. scrape-job-worker: Processes scrape_jobs queue (runs every 2 minutes)

-- ============================================================
-- PREREQUISITES
-- ============================================================
-- 1. Enable pg_cron extension: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Enable http extension: CREATE EXTENSION IF NOT EXISTS http;
-- 3. Set app_settings.supabase_url (your Supabase project URL)
-- 4. Optionally set app_settings.scrape_trigger_token (if using SCRAPE_TRIGGER_TOKEN)
-- 5. Optionally set app_settings.service_role_key (for auth)

-- ============================================================
-- CREATE app_settings TABLE (if doesn't exist)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_settings FROM PUBLIC;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- ============================================================
-- FUNCTION: trigger_scheduled_scraping()
-- ============================================================
-- Calls scrape-all-scheduled Edge Function to enqueue jobs
-- (Creates if doesn't exist, replaces if exists)
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_scheduled_scraping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  trigger_token TEXT;
  service_role_key TEXT;
  response_status INT;
  response_content TEXT;
BEGIN
  -- Get Supabase URL and optional trigger token from app_settings
  SELECT value INTO supabase_url
  FROM public.app_settings
  WHERE key = 'supabase_url';

  SELECT value INTO trigger_token
  FROM public.app_settings
  WHERE key = 'scrape_trigger_token';

  SELECT value INTO service_role_key
  FROM public.app_settings
  WHERE key = 'service_role_key';
  
  -- Validate configuration
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured. Skipping scrape-all-scheduled call.';
    RETURN;
  END IF;

  -- Build headers: prefer service_role_key, fallback to trigger_token
  DECLARE
    headers_json JSONB;
  BEGIN
    IF service_role_key IS NOT NULL AND service_role_key <> '' THEN
      headers_json := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      );
    ELSIF trigger_token IS NOT NULL AND trigger_token <> '' AND trigger_token <> 'CHANGE_ME' THEN
      headers_json := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scrape-trigger-token', trigger_token
      );
    ELSE
      headers_json := jsonb_build_object('Content-Type', 'application/json');
    END IF;

    -- Call the Edge Function via HTTP
    SELECT status, content INTO response_status, response_content
    FROM http((
      SELECT
        method := 'POST',
        url := supabase_url || '/functions/v1/scrape-all-scheduled',
        headers := headers_json,
        body := '{}'::jsonb
      )::http_request
    ));

    -- Log errors only
    IF response_status != 200 THEN
      RAISE WARNING 'scrape-all-scheduled returned status %: %', response_status, response_content;
    END IF;
  END;
END;
$$;

-- ============================================================
-- FUNCTION: trigger_scrape_job_worker()
-- ============================================================
-- Calls scrape-job-worker Edge Function to process the queue
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_scrape_job_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  trigger_token TEXT;
  service_role_key TEXT;
  response_status INT;
  response_content TEXT;
BEGIN
  -- Get Supabase URL and optional trigger token from app_settings
  SELECT value INTO supabase_url
  FROM public.app_settings
  WHERE key = 'supabase_url';

  SELECT value INTO trigger_token
  FROM public.app_settings
  WHERE key = 'scrape_trigger_token';

  SELECT value INTO service_role_key
  FROM public.app_settings
  WHERE key = 'service_role_key';
  
  -- Validate configuration
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured. Skipping scrape-job-worker call.';
    RETURN;
  END IF;

  -- Build headers: prefer service_role_key, fallback to trigger_token
  DECLARE
    headers_json JSONB;
  BEGIN
    IF service_role_key IS NOT NULL AND service_role_key <> '' THEN
      headers_json := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      );
    ELSIF trigger_token IS NOT NULL AND trigger_token <> '' AND trigger_token <> 'CHANGE_ME' THEN
      headers_json := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scrape-trigger-token', trigger_token
      );
    ELSE
      headers_json := jsonb_build_object('Content-Type', 'application/json');
    END IF;

    -- Call the Edge Function via HTTP
    SELECT status, content INTO response_status, response_content
    FROM http((
      SELECT
        method := 'POST',
        url := supabase_url || '/functions/v1/scrape-job-worker',
        headers := headers_json,
        body := '{}'::jsonb
      )::http_request
    ));

    -- Log errors only (success is silent to avoid spam)
    IF response_status != 200 THEN
      RAISE WARNING 'scrape-job-worker returned status %: %', response_status, response_content;
    END IF;
  END;
END;
$$;

-- ============================================================
-- SCHEDULE CRON JOBS
-- ============================================================

-- Job 1: Enqueue scrape jobs (scrape-all-scheduled)
-- Runs every 12 hours at :00 minutes (00:00 and 12:00 UTC)
-- Remove existing job if it exists
SELECT cron.unschedule('enqueue-scrape-jobs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'enqueue-scrape-jobs'
);

-- Schedule enqueue job (every 12 hours)
SELECT cron.schedule(
  'enqueue-scrape-jobs',
  '0 */12 * * *', -- Every 12 hours at :00 minutes
  $$SELECT trigger_scheduled_scraping();$$
);

-- Job 2: Process scrape queue (scrape-job-worker)
-- Runs every 2 minutes
-- Remove existing job if it exists
SELECT cron.unschedule('process-scrape-jobs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scrape-jobs'
);

-- Schedule worker job (every 2 minutes)
SELECT cron.schedule(
  'process-scrape-jobs',
  '*/2 * * * *', -- Every 2 minutes
  $$SELECT trigger_scrape_job_worker();$$
);

-- ============================================================
-- CONFIGURATION REQUIRED
-- ============================================================
-- After running this migration, configure app_settings:
--
-- 1. Set your Supabase project URL:
--    INSERT INTO public.app_settings(key, value)
--    VALUES ('supabase_url', 'https://your-project.supabase.co')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
-- 2. (Recommended) Set service_role_key for authentication:
--    INSERT INTO public.app_settings(key, value)
--    VALUES ('service_role_key', 'your-service-role-key-here')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
--    OR set scrape_trigger_token (if using SCRAPE_TRIGGER_TOKEN env var):
--    INSERT INTO public.app_settings(key, value)
--    VALUES ('scrape_trigger_token', 'your-token-here')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this to verify both jobs are scheduled:
-- SELECT jobname, schedule, active, command FROM cron.job WHERE jobname IN ('enqueue-scrape-jobs', 'process-scrape-jobs');
--
-- To check if settings are configured:
-- SELECT key, CASE WHEN key = 'service_role_key' OR key = 'scrape_trigger_token' THEN '***HIDDEN***' ELSE value END as value FROM public.app_settings WHERE key IN ('supabase_url', 'service_role_key', 'scrape_trigger_token');
