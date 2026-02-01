-- Allow any workspace member (not just campaign owner) to manage campaign share links.

-- Helper: check if the current user is in the same workspace as a given campaign.
CREATE OR REPLACE FUNCTION public.is_campaign_workspace_member(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.campaigns c
    JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = p_campaign_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
  );
END;
$$;

-- SELECT: replace owner-only policy with workspace-member policy
DROP POLICY IF EXISTS "Campaign owners can view share links" ON public.campaign_share_links;
DROP POLICY IF EXISTS "Anyone can view share links"          ON public.campaign_share_links;

CREATE POLICY "Workspace members can view campaign share links"
  ON public.campaign_share_links FOR SELECT
  USING (public.is_campaign_workspace_member(campaign_id));

-- INSERT: allow any workspace member to create share links
DROP POLICY IF EXISTS "Campaign owners can create share links" ON public.campaign_share_links;

CREATE POLICY "Workspace members can create campaign share links"
  ON public.campaign_share_links FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_campaign_workspace_member(campaign_id)
  );

-- UPDATE: allow any workspace member to update share links
DROP POLICY IF EXISTS "Campaign owners can update their share links" ON public.campaign_share_links;

CREATE POLICY "Workspace members can update campaign share links"
  ON public.campaign_share_links FOR UPDATE
  USING  (public.is_campaign_workspace_member(campaign_id))
  WITH CHECK (public.is_campaign_workspace_member(campaign_id));

-- DELETE: allow any workspace member to delete share links
DROP POLICY IF EXISTS "Campaign owners can delete their share links" ON public.campaign_share_links;

CREATE POLICY "Workspace members can delete campaign share links"
  ON public.campaign_share_links FOR DELETE
  USING (public.is_campaign_workspace_member(campaign_id));
