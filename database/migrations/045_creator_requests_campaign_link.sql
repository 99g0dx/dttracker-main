-- Link creator requests to campaigns (optional)

ALTER TABLE public.creator_requests
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creator_requests_campaign_id
  ON public.creator_requests(campaign_id);

-- Update insert policy to allow campaign-linked requests for workspace members
DROP POLICY IF EXISTS "Users can create their own creator requests"
  ON public.creator_requests;

CREATE POLICY "Users can create their own creator requests"
  ON public.creator_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      campaign_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.campaigns c
        WHERE c.id = creator_requests.campaign_id
          AND public.is_workspace_member(c.workspace_id, auth.uid())
      )
    )
  );
