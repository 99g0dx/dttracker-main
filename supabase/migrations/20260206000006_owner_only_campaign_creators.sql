-- Restrict campaign_creators changes to workspace owners only

ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert campaign_creators for campaigns they own or edit"
  ON public.campaign_creators;
DROP POLICY IF EXISTS "Users can delete campaign_creators for campaigns they own or edit"
  ON public.campaign_creators;
DROP POLICY IF EXISTS "Workspace owners can add campaign creators"
  ON public.campaign_creators;
DROP POLICY IF EXISTS "Workspace owners can remove campaign creators"
  ON public.campaign_creators;

CREATE POLICY "Workspace owners can add campaign creators"
  ON public.campaign_creators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = campaign_creators.campaign_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.workspace_creators wc
      WHERE wc.workspace_id = (
        SELECT c.workspace_id
        FROM public.campaigns c
        WHERE c.id = campaign_creators.campaign_id
      )
      AND wc.creator_id = campaign_creators.creator_id
    )
  );

CREATE POLICY "Workspace owners can remove campaign creators"
  ON public.campaign_creators FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = campaign_creators.campaign_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );
