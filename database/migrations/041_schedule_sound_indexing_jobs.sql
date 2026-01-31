-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Schedule sound indexing worker to run every 5 minutes to process queued jobs
SELECT cron.schedule(
  'process-sound-indexing-queue',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url:='https://' || current_setting('app.supabase_url') || '/functions/v1/sound-index-worker',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body:=jsonb_build_object('action', 'process_queue')
    ) AS request_id;
  $$
);

-- Schedule automatic refresh of stale sounds (daily at 2 AM)
-- This re-indexes sounds that haven't been updated in 24 hours
SELECT cron.schedule(
  'refresh-stale-sounds',
  '0 2 * * *',  -- Daily at 2 AM
  $$
  INSERT INTO public.sound_refresh_queue (sound_id, action, status, priority)
  SELECT
    id,
    'refresh',
    'pending',
    CASE
      WHEN last_crawled_at < NOW() - INTERVAL '24 hours' THEN 5   -- Medium priority
      WHEN last_crawled_at < NOW() - INTERVAL '7 days' THEN 1    -- Low priority
      ELSE 0
    END
  FROM public.sounds
  WHERE
    indexing_state = 'active'
    AND (
      last_crawled_at IS NULL
      OR last_crawled_at < NOW() - INTERVAL '24 hours'
    )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sound_refresh_queue
    WHERE sound_id = sounds.id
    AND status IN ('pending', 'processing')
  )
  ORDER BY last_crawled_at ASC NULLS FIRST
  LIMIT 50;
  $$
);

-- Schedule cleanup of completed jobs older than 30 days
SELECT cron.schedule(
  'cleanup-sound-queue',
  '0 3 * * *',  -- Daily at 3 AM
  $$
  DELETE FROM public.sound_refresh_queue
  WHERE
    status = 'completed'
    AND completed_at < NOW() - INTERVAL '30 days';
  $$
);
