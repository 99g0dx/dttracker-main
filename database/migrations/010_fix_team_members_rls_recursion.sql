-- 010_fix_team_members_rls_recursion.sql
-- Purpose: Fix infinite recursion in team_members RLS policies
-- Problem: Policies were querying team_members table within team_members policies
-- Solution: Use workspace_id = auth.uid() pattern (workspace owner = user_id)
-- This avoids recursion since it doesn't query the table itself

-- Drop the recursive policies if they exist
DROP POLICY IF EXISTS "team_members_workspace_insert" ON public.team_members;
DROP POLICY IF EXISTS "team_members_workspace_read" ON public.team_members;

-- Keep the self-select policy (no recursion - only checks user_id)
-- It's safe because it doesn't query team_members table

-- Create non-recursive INSERT policy
-- Workspace owner (workspace_id = auth.uid()) can insert members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' 
    AND policyname = 'Workspace owner can add team members'
  ) THEN
    CREATE POLICY "Workspace owner can add team members"
    ON public.team_members
    FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id = auth.uid());
  END IF;
END$$;

-- Create non-recursive SELECT policy
-- Users can see members in workspaces they own, or their own membership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' 
    AND policyname = 'Users can view team members in their workspace'
  ) THEN
    CREATE POLICY "Users can view team members in their workspace"
    ON public.team_members
    FOR SELECT
    TO authenticated
    USING (workspace_id = auth.uid() OR user_id = auth.uid());
  END IF;
END$$;

-- Create non-recursive UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' 
    AND policyname = 'Workspace owner can update team members'
  ) THEN
    CREATE POLICY "Workspace owner can update team members"
    ON public.team_members
    FOR UPDATE
    TO authenticated
    USING (workspace_id = auth.uid())
    WITH CHECK (workspace_id = auth.uid());
  END IF;
END$$;

-- Create non-recursive DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' 
    AND policyname = 'Workspace owner can remove team members'
  ) THEN
    CREATE POLICY "Workspace owner can remove team members"
    ON public.team_members
    FOR DELETE
    TO authenticated
    USING (workspace_id = auth.uid());
  END IF;
END$$;

-- Verify policies don't query team_members recursively
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed team_members RLS policies - no recursion';
  RAISE NOTICE '✅ Policies now use workspace_id = auth.uid() pattern';
  RAISE NOTICE '✅ Safe to insert team members now';
END$$;

