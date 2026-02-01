-- Allow workspace owners to insert/delete creator request items for workspace requests

DROP POLICY IF EXISTS "Workspace owners can insert request items" ON public.creator_request_items;
CREATE POLICY "Workspace owners can insert request items"
  ON public.creator_request_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.creator_requests cr
      JOIN public.campaigns c ON c.id = cr.campaign_id
      WHERE cr.id = creator_request_items.request_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace owners can delete request items" ON public.creator_request_items;
CREATE POLICY "Workspace owners can delete request items"
  ON public.creator_request_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.creator_requests cr
      JOIN public.campaigns c ON c.id = cr.campaign_id
      WHERE cr.id = creator_request_items.request_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );
