-- Update workspace_creators RLS to support workspace membership

ALTER TABLE public.workspace_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Users can insert their workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Users can delete their workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Workspace members can view workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Workspace members can insert workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Workspace admins can delete workspace creators" ON public.workspace_creators;

CREATE POLICY "Workspace members can view workspace creators"
  ON public.workspace_creators FOR SELECT
  USING (
    workspace_id = auth.uid()
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Workspace members can insert workspace creators"
  ON public.workspace_creators FOR INSERT
  WITH CHECK (
    workspace_id = auth.uid()
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Workspace admins can delete workspace creators"
  ON public.workspace_creators FOR DELETE
  USING (
    workspace_id = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );
