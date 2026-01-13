-- Fix Campaign Creation RLS Policy
-- Run this in your Supabase SQL Editor

-- Step 1: Check if workspace_id column exists (it shouldn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
    AND column_name = 'workspace_id'
  ) THEN
    RAISE NOTICE 'WARNING: workspace_id column exists in campaigns table - removing it';
    ALTER TABLE public.campaigns DROP COLUMN workspace_id;
  ELSE
    RAISE NOTICE 'Good: workspace_id column does not exist';
  END IF;
END $$;

-- Step 2: Verify RLS is enabled
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop and recreate the INSERT policy
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;

CREATE POLICY "Users can insert their own campaigns"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Verify the policy was created correctly
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'campaigns'
  AND cmd = 'INSERT';

-- Step 5: Show current table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'campaigns'
ORDER BY ordinal_position;
