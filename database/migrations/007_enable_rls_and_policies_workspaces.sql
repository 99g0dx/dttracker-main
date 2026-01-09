-- 007_enable_rls_and_policies_workspaces.sql
-- Purpose: Enable RLS on workspaces and allow workspace members to read

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_member_read'
  ) THEN
    CREATE POLICY workspaces_member_read ON public.workspaces
      FOR SELECT TO authenticated
      USING (
        id = (SELECT auth.uid()) OR -- Support current model: workspace_id = user_id
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.workspace_id = public.workspaces.id
            AND tm.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END$$;

-- Allow authenticated users to INSERT a workspace when created_by matches their auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_insert_owner_check'
  ) THEN
    CREATE POLICY workspaces_insert_owner_check ON public.workspaces
      FOR INSERT TO authenticated
      WITH CHECK (created_by = (SELECT auth.uid()));
  END IF;
END$$;

