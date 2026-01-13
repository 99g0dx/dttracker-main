-- ============================================================
-- CAMPAIGNS TABLE VERIFICATION SCRIPT
-- ============================================================
-- Run this script to verify that the 'campaigns' table and its
-- RLS policies are properly configured in your Supabase database.
-- ============================================================

-- Check 1: Verify 'campaigns' table exists
SELECT
  'Table Existence' as category,
  'public.campaigns' as item,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status,
  'Ensure database/schema.sql has been run.' as recommendation;

-- Check 2: Verify RLS is enabled on 'campaigns' table
SELECT
  'RLS Status' as category,
  'public.campaigns' as item,
  CASE
    WHEN relrowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as status,
  'Run ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;' as recommendation
FROM pg_class
WHERE relname = 'campaigns';

-- Check 3: Verify SELECT policy for 'campaigns'
SELECT
  'RLS Policy: SELECT' as category,
  'Users can view their own campaigns' as item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'Users can view their own campaigns'
    ) THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status,
  'Ensure the SELECT policy from database/schema.sql is applied.' as recommendation;

-- Check 4: Verify INSERT policy for 'campaigns'
SELECT
  'RLS Policy: INSERT' as category,
  'Users can insert their own campaigns' as item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'Users can insert their own campaigns'
    ) THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status,
  'Ensure the INSERT policy from database/schema.sql is applied.' as recommendation;

-- Check 5: Verify UPDATE policy for 'campaigns'
SELECT
  'RLS Policy: UPDATE' as category,
  'Users can update their own campaigns' as item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'Users can update their own campaigns'
    ) THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status,
  'Ensure the UPDATE policy from database/schema.sql is applied.' as recommendation;

-- Check 6: Verify DELETE policy for 'campaigns'
SELECT
  'RLS Policy: DELETE' as category,
  'Users can delete their own campaigns' as item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'Users can delete their own campaigns'
    ) THEN '✅ Exists'
    ELSE '❌ Missing'
  END as status,
  'Ensure the DELETE policy from database/schema.sql is applied.' as recommendation;

-- Check 7: Verify related tables exist
SELECT
  'Related Tables' as category,
  tablename as item,
  '✅ Exists' as status,
  'Table is present' as recommendation
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('posts', 'campaign_creators', 'campaign_members', 'post_metrics')
ORDER BY tablename;
