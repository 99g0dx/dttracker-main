-- ============================================================
-- AUTO-SCRAPING CONFIGURATION
-- ============================================================
-- Run this script AFTER running setup_auto_scraping.sql
-- 
-- INSTRUCTIONS:
-- 1. Get your Supabase Project URL from: Dashboard → Settings → API → Project URL
-- 2. Get your Service Role Key from: Dashboard → Settings → API → Service Role key
-- 3. Replace the values below with your actual values
-- 4. Run this script in Supabase SQL Editor
-- ============================================================

-- STEP 1: Set your Supabase Project URL
-- Replace 'https://ucbueapoexnxhttynfzy.supabase.co' with your actual URL
ALTER DATABASE postgres SET app.supabase_url = 'https://ucbueapoexnxhttynfzy.supabase.co';

-- STEP 2: Set your Service Role Key
-- Replace the key below with your actual service role key
-- WARNING: Keep this secret! It has admin access to your database.
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYnVlYXBvZXhueGh0dHluZnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0MzY5MiwiZXhwIjoyMDgyNDE5NjkyfQ.mhCinNZXETF2Ql0tPnoqdi4l9H-jlQRn23_b3yiF7ag';

-- STEP 3: Verify the settings were applied
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




