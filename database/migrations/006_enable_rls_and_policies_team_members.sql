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

-- Allow workspace owners to INSERT members (for invite flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'team_members_workspace_insert'
  ) THEN
    CREATE POLICY team_members_workspace_insert ON public.team_members
      FOR INSERT TO authenticated
      WITH CHECK (
        workspace_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.workspace_id = team_members.workspace_id
            AND tm.user_id = (SELECT auth.uid())
            AND tm.role IN ('owner','admin')
        )
      );
  END IF;
END$$;

-- Allow members of a workspace to SELECT other members of same workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'team_members_workspace_read'
  ) THEN
    CREATE POLICY team_members_workspace_read ON public.team_members
      FOR SELECT TO authenticated
      USING (
        workspace_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.workspace_id = public.team_members.workspace_id
            AND tm.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END$$;

