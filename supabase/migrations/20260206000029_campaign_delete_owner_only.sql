-- Campaign delete: only workspace owner (brand_owner) can delete campaigns.
-- Operators can create/edit campaigns but not delete them.

DROP POLICY IF EXISTS campaigns_delete_workspace_editor ON public.campaigns;
DROP POLICY IF EXISTS campaigns_delete_owner_only ON public.campaigns;

CREATE POLICY campaigns_delete_owner_only
  ON public.campaigns
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role = 'brand_owner'
    )
  );
