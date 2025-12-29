-- ============================================================
-- AUTO-SCRAPING VERIFICATION SCRIPT
-- ============================================================
-- Run this script to verify that auto-scraping is properly configured
-- ============================================================

-- Check 1: Database Settings
SELECT 
  'Database Settings' as category,
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

-- Check 2: Extensions
SELECT 
  'Extensions' as category,
  extname as extension_name,
  CASE 
    WHEN extname = 'pg_cron' THEN '✅ Enabled'
    WHEN extname = 'http' THEN '✅ Enabled'
    ELSE '❌ Missing'
  END as status
FROM pg_extension
WHERE extname IN ('pg_cron', 'http');

-- Check 3: Trigger Function
SELECT 
  'Functions' as category,
  proname as function_name,
  CASE 
    WHEN proname = 'trigger_scheduled_scraping' THEN '✅ Exists'
    ELSE '❌ Not Found'
  END as status
FROM pg_proc
WHERE proname = 'trigger_scheduled_scraping';

-- Check 4: Cron Job
SELECT 
  'Cron Jobs' as category,
  jobname,
  schedule,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status,
  command
FROM cron.job
WHERE jobname = 'daily-auto-scrape';

-- Check 5: Indexes on post_metrics
SELECT 
  'Indexes' as category,
  indexname as index_name,
  tablename as table_name,
  '✅ Exists' as status
FROM pg_indexes
WHERE tablename = 'post_metrics'
  AND indexname IN (
    'idx_post_metrics_scraped_at',
    'idx_post_metrics_post_id',
    'idx_post_metrics_post_scraped'
  )
ORDER BY indexname;

-- Summary
SELECT 
  CASE 
    WHEN (
      (SELECT COUNT(*) FROM pg_settings WHERE name = 'app.supabase_url' AND setting != '') = 1 AND
      (SELECT COUNT(*) FROM pg_settings WHERE name = 'app.service_role_key' AND setting != '') = 1 AND
      (SELECT COUNT(*) FROM pg_proc WHERE proname = 'trigger_scheduled_scraping') = 1 AND
      (SELECT COUNT(*) FROM cron.job WHERE jobname = 'daily-auto-scrape' AND active = true) = 1
    ) THEN '✅ All checks passed! Auto-scraping is configured correctly.'
    ELSE '❌ Some checks failed - review the results above and fix any issues.'
  END as overall_status;

-- Optional: Test the trigger function (uncomment to test)
-- WARNING: This will trigger scraping immediately!
-- SELECT trigger_scheduled_scraping();

-- View recent cron job executions (if any)
SELECT 
  'Execution History' as category,
  runid,
  status,
  return_message,
  start_time,
  end_time,
  CASE 
    WHEN end_time IS NULL THEN EXTRACT(EPOCH FROM (NOW() - start_time)) || ' seconds (running)'
    ELSE EXTRACT(EPOCH FROM (end_time - start_time)) || ' seconds'
  END as duration
FROM cron.job_run_details
WHERE jobname = 'daily-auto-scrape'
ORDER BY start_time DESC
LIMIT 5;



