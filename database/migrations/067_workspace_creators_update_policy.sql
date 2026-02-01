-- Allow UPDATE on workspace_creators so upsert (INSERT ... ON CONFLICT DO UPDATE) succeeds on double-tap.
-- Without this policy, the second tap's ensureWorkspaceCreator hits ON CONFLICT DO UPDATE and RLS denies it.

DROP POLICY IF EXISTS workspace_creators_update ON public.workspace_creators;
CREATE POLICY workspace_creators_update
  ON public.workspace_creators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member')
    )
  );
