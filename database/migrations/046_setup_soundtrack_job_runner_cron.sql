-- Migration: Setup cron job for soundtrack_job_runner
-- This schedules the job runner to run every 5 minutes to process queued jobs

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists
SELECT cron.unschedule('soundtrack-job-runner') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'soundtrack-job-runner'
);

-- Schedule the job runner to run every 5 minutes
-- Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- You can find this in your Supabase dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
SELECT cron.schedule(
  'soundtrack-job-runner',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/soundtrack_job_runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Note: You need to:
-- 1. Replace YOUR_PROJECT_REF with your actual project reference
-- 2. Set the service_role_key in app.settings (or use a different auth method)
-- 3. Alternatively, use Supabase's built-in cron functionality via Dashboard → Database → Cron Jobs

-- Alternative: Use Supabase Dashboard to set up cron
-- Go to: Database → Cron Jobs → New Cron Job
-- Name: soundtrack-job-runner
-- Schedule: */5 * * * * (every 5 minutes)
-- Command: SELECT net.http_post(...) as above
-- Or use the HTTP request method if available
