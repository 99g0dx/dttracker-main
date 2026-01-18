-- ============================================================
-- AUTO-SCRAPING CONFIGURATION
-- ============================================================
-- Run this script AFTER running setup_auto_scraping.sql
-- 
-- INSTRUCTIONS:
-- 1. Get your Supabase Project URL from: Dashboard → Settings → API → Project URL
-- 2. Generate a random token for scrape trigger (optional but recommended)
-- 3. Replace the values below with your actual values
-- 4. Run this script in Supabase SQL Editor
-- ============================================================

-- Ensure settings table exists
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_settings FROM PUBLIC;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- STEP 1: Set your Supabase Project URL
-- Replace the value below with your actual URL
INSERT INTO public.app_settings(key, value)
VALUES ('supabase_url', 'https://ucbueapoexnxhttynfzy.supabase.co')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- STEP 2 (Optional): Set a trigger token
-- Replace the value below with a random secret, then set the same value
-- as SCRAPE_TRIGGER_TOKEN in the Edge Function env vars.
INSERT INTO public.app_settings(key, value)
VALUES ('scrape_trigger_token', 'CHANGE_ME')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- STEP 3: Verify the settings were applied
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





