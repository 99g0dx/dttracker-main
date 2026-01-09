-- ============================================================
-- Fix RLS Infinite Recursion Error
-- Run this in Supabase SQL Editor to fix the recursion issue
-- ============================================================

-- Drop recursive team_members policies
DROP POLICY IF EXISTS "team_members_workspace_insert" ON public.team_members;
DROP POLICY IF EXISTS "team_members_workspace_read" ON public.team_members;

-- Create non-recursive team_members policies
CREATE POLICY "Workspace owner can add team members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Users can view team members in their workspace"
ON public.team_members
FOR SELECT
TO authenticated
USING (workspace_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Workspace owner can update team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (workspace_id = auth.uid())
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can remove team members"
ON public.team_members
FOR DELETE
TO authenticated
USING (workspace_id = auth.uid());

-- Drop recursive team_invites policies
DROP POLICY IF EXISTS "Users can create invites in their workspace" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owners can update invites" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owners can delete invites" ON public.team_invites;

-- Create non-recursive team_invites policies
CREATE POLICY "Workspace owner can create invites"
ON public.team_invites
FOR INSERT
TO authenticated
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can update invites"
ON public.team_invites
FOR UPDATE
TO authenticated
USING (workspace_id = auth.uid())
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can delete invites"
ON public.team_invites
FOR DELETE
TO authenticated
USING (workspace_id = auth.uid());

-- Verification: Check policies were created correctly
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('team_members', 'team_invites')
ORDER BY tablename, policyname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies fixed - no more recursion!';
  RAISE NOTICE '✅ Team invites should work now';
END$$;

