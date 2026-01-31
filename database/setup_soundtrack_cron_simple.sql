-- Simple Cron Setup for Soundtrack Job Runner
-- Run this in Supabase SQL Editor after deploying soundtrack_job_runner function
-- 
-- IMPORTANT: Replace the placeholders below with your actual values:
-- 1. YOUR_PROJECT_REF - Find in: Supabase Dashboard → Settings → API → Project URL (the part before .supabase.co)
-- 2. YOUR_SERVICE_ROLE_KEY - Find in: Supabase Dashboard → Settings → API → service_role key

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'soundtrack-job-runner') THEN
    PERFORM cron.unschedule('soundtrack-job-runner');
  END IF;
END $$;

-- Schedule the job runner
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values before running
SELECT cron.schedule(
  'soundtrack-job-runner',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/soundtrack_job_runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Option 2: Manual Setup via Supabase Dashboard
-- If pg_cron doesn't work, use Supabase's built-in cron:
-- 1. Go to: Supabase Dashboard → Database → Cron Jobs
-- 2. Click "New Cron Job"
-- 3. Name: soundtrack-job-runner
-- 4. Schedule: */5 * * * * (every 5 minutes)
-- 5. Command: Use HTTP request to call the function
-- 6. Or use an external cron service like cron-job.org
