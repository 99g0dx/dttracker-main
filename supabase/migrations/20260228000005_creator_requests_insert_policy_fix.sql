-- Fix creator_requests INSERT RLS when linking to a campaign.
-- The previous policy used a subquery on campaigns, which is subject to campaigns'
-- RLS; if the user cannot SELECT that campaign row, the check fails.
-- Use a SECURITY DEFINER function so the campaign lookup bypasses RLS.

CREATE OR REPLACE FUNCTION public.can_link_creator_request_to_campaign(
  p_campaign_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND public.is_workspace_member(c.workspace_id, p_user_id)
  );
END;
$$;

COMMENT ON FUNCTION public.can_link_creator_request_to_campaign(UUID, UUID) IS
  'Returns true if campaign_id is null or the user is a member of the campaign workspace. Used by creator_requests INSERT RLS.';

-- Recreate the INSERT policy to use the function instead of inline subquery
DROP POLICY IF EXISTS "Users can create their own creator requests"
  ON public.creator_requests;

CREATE POLICY "Users can create their own creator requests"
  ON public.creator_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_link_creator_request_to_campaign(campaign_id, auth.uid())
  );
