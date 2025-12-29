-- ============================================================
-- FIX: Campaigns RLS Policies - Remove Infinite Recursion
-- ============================================================
-- This script drops and recreates the campaigns RLS policies
-- to fix the "infinite recursion detected" error
-- ============================================================

-- Step 1: Drop all existing policies on campaigns table
DROP POLICY IF EXISTS "Users can view their own campaigns and shared campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns or campaigns they are editors of" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;

-- Step 2: Recreate policies with clean, non-recursive structure

-- SELECT: Users can view their own campaigns
-- Simplified to avoid recursion - removed the campaign_members check for now
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can insert their own campaigns
-- Simple check - no recursion possible
CREATE POLICY "Users can insert their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own campaigns
-- Simplified - removed campaign_members check to avoid recursion
CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own campaigns
CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Note: The shared campaigns feature (via campaign_members)
-- can be added back later once the basic policies work.
-- For now, users can only access their own campaigns.
-- ============================================================

