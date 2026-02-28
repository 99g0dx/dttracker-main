-- Migration: Restore scheduled scraping cron jobs
-- Description: Re-creates trigger_scheduled_scraping() and trigger_scrape_job_worker()
--              and reschedules enqueue-scrape-jobs (every 30 min) and process-scrape-jobs
--              (every 2 min), which were removed in 20260229000001.

-- ============================================================
-- FUNCTION: trigger_scheduled_scraping()
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
  headers_json JSONB;
  response_status INT;
  response_content TEXT;
BEGIN
  SELECT value INTO supabase_url
  FROM public.app_settings
  WHERE key = 'supabase_url';

  SELECT value INTO trigger_token
  FROM public.app_settings
  WHERE key = 'scrape_trigger_token';

  SELECT value INTO service_role_key
  FROM public.app_settings
  WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured. Skipping scrape-all-scheduled call.';
    RETURN;
  END IF;

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

  SELECT status, content INTO response_status, response_content
  FROM http(
    ROW(
      'POST',
      supabase_url || '/functions/v1/scrape-all-scheduled',
      ARRAY(SELECT (k, v)::http_header FROM jsonb_each_text(headers_json) AS t(k, v)),
      'application/json',
      '{}'
    )::http_request
  );

  IF response_status != 200 THEN
    RAISE WARNING 'scrape-all-scheduled returned status %: %', response_status, response_content;
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: trigger_scrape_job_worker()
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
  headers_json JSONB;
  response_status INT;
  response_content TEXT;
BEGIN
  SELECT value INTO supabase_url
  FROM public.app_settings
  WHERE key = 'supabase_url';

  SELECT value INTO trigger_token
  FROM public.app_settings
  WHERE key = 'scrape_trigger_token';

  SELECT value INTO service_role_key
  FROM public.app_settings
  WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured. Skipping scrape-job-worker call.';
    RETURN;
  END IF;

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

  SELECT status, content INTO response_status, response_content
  FROM http(
    ROW(
      'POST',
      supabase_url || '/functions/v1/scrape-job-worker',
      ARRAY(SELECT (k, v)::http_header FROM jsonb_each_text(headers_json) AS t(k, v)),
      'application/json',
      '{}'
    )::http_request
  );

  IF response_status != 200 THEN
    RAISE WARNING 'scrape-job-worker returned status %: %', response_status, response_content;
  END IF;
END;
$$;

-- ============================================================
-- SCHEDULE CRON JOBS
-- ============================================================

-- Job 1: Enqueue scrape jobs (scrape-all-scheduled) — every 30 minutes
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

-- Job 2: Process scrape queue (scrape-job-worker) — every 2 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scrape-jobs') THEN
    PERFORM cron.unschedule('process-scrape-jobs');
  END IF;
END $$;

SELECT cron.schedule(
  'process-scrape-jobs',
  '*/2 * * * *',
  $$SELECT trigger_scrape_job_worker();$$
);

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT jobname, schedule, active FROM cron.job
-- WHERE jobname IN ('enqueue-scrape-jobs', 'process-scrape-jobs');
