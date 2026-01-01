-- 006_enable_rls_and_policies_team_members.sql
-- Purpose: Enable RLS and create basic policies for team_members
-- Note: These policies complement existing ones and use IF NOT EXISTS checks

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own membership row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'team_members_self_select'
  ) THEN
    CREATE POLICY team_members_self_select ON public.team_members
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END$$;

-- Non-recursive INSERT policy: workspace owner can add members
-- Uses workspace_id = auth.uid() pattern (no recursion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'Workspace owner can add team members'
  ) THEN
    CREATE POLICY "Workspace owner can add team members" ON public.team_members
      FOR INSERT TO authenticated
      WITH CHECK (workspace_id = auth.uid());
  END IF;
END$$;

-- Non-recursive SELECT policy: users can see members in their workspace or their own membership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'Users can view team members in their workspace'
  ) THEN
    CREATE POLICY "Users can view team members in their workspace" ON public.team_members
      FOR SELECT TO authenticated
      USING (workspace_id = auth.uid() OR user_id = auth.uid());
  END IF;
END$$;

-- Non-recursive UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'Workspace owner can update team members'
  ) THEN
    CREATE POLICY "Workspace owner can update team members" ON public.team_members
      FOR UPDATE TO authenticated
      USING (workspace_id = auth.uid())
      WITH CHECK (workspace_id = auth.uid());
  END IF;
END$$;

-- Non-recursive DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'Workspace owner can remove team members'
  ) THEN
    CREATE POLICY "Workspace owner can remove team members" ON public.team_members
      FOR DELETE TO authenticated
      USING (workspace_id = auth.uid());
  END IF;
END$$;

