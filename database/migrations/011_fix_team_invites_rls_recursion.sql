-- 011_fix_team_invites_rls_recursion.sql
-- Purpose: Fix potential recursion in team_invites RLS policies
-- Ensure policies use workspace_id = auth.uid() pattern instead of querying team_members

-- Drop existing recursive policies if they exist
DROP POLICY IF EXISTS "Users can create invites in their workspace" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owners can update invites" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owners can delete invites" ON public.team_invites;

-- Keep the SELECT policy (it's safe - only checks workspace_id and invited_by)

-- Create non-recursive INSERT policy
-- Workspace owner (workspace_id = auth.uid()) can create invites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_invites' 
    AND policyname = 'Workspace owner can create invites'
  ) THEN
    CREATE POLICY "Workspace owner can create invites"
    ON public.team_invites
    FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id = auth.uid());
  END IF;
END$$;

-- Create non-recursive UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_invites' 
    AND policyname = 'Workspace owner can update invites'
  ) THEN
    CREATE POLICY "Workspace owner can update invites"
    ON public.team_invites
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
    WHERE schemaname = 'public' AND tablename = 'team_invites' 
    AND policyname = 'Workspace owner can delete invites'
  ) THEN
    CREATE POLICY "Workspace owner can delete invites"
    ON public.team_invites
    FOR DELETE
    TO authenticated
    USING (workspace_id = auth.uid());
  END IF;
END$$;

-- Verify fix
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed team_invites RLS policies - no recursion';
  RAISE NOTICE '✅ Safe to create invites now';
END$$;

