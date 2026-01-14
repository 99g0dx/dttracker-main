-- 020_update_campaign_creators_insert_policy.sql
-- Purpose: Allow campaign members/owners to add creators from their workspace or marketplace.

DROP POLICY IF EXISTS "Users can insert campaign_creators for campaigns they own or ed" ON public.campaign_creators;

CREATE POLICY "Users can insert campaign_creators for campaigns they own or ed"
  ON public.campaign_creators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = campaign_creators.campaign_id
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.campaign_members cm
            WHERE cm.campaign_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.role = ANY (ARRAY['owner'::text, 'editor'::text])
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.creators cr
      WHERE cr.id = campaign_creators.creator_id
        AND (
          cr.user_id = auth.uid()
          OR cr.user_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.workspace_creators wc
            WHERE wc.creator_id = cr.id
              AND wc.workspace_id = (
                SELECT c.workspace_id
                FROM public.campaigns c
                WHERE c.id = campaign_creators.campaign_id
              )
          )
        )
    )
  );
