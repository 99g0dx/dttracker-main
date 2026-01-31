-- Restrict workspace_creators changes to workspace owners only

ALTER TABLE public.workspace_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can insert workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Workspace admins can delete workspace creators" ON public.workspace_creators;

CREATE POLICY "Workspace owners can insert workspace creators"
  ON public.workspace_creators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_creators.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can delete workspace creators"
  ON public.workspace_creators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_creators.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );
