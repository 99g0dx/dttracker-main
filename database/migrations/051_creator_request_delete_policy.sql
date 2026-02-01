-- Restrict deletion: operators can only delete their own unsent suggestions

DROP POLICY IF EXISTS "Users can delete their own creator requests" ON public.creator_requests;
CREATE POLICY "Users can delete their own creator requests"
  ON public.creator_requests FOR DELETE
  USING (
    (
      user_id = auth.uid()
      AND submission_type = 'suggestion'
      AND status = 'suggested'
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = creator_requests.campaign_id
        AND public.is_workspace_owner(c.workspace_id, auth.uid())
    )
  );
