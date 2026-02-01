-- Security hardening: tighten creator visibility, share links, invites, and campaign policies

-- Creators: remove global visibility
DROP POLICY IF EXISTS "Authenticated users can view all creators" ON public.creators;
DROP POLICY IF EXISTS "Allow authenticated users to view all creators" ON public.creators;

-- Creators: allow workspace members to see creators in their workspace library
DROP POLICY IF EXISTS "workspace members can view workspace creators" ON public.creators;
CREATE POLICY "workspace members can view workspace creators"
  ON public.creators FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_creators wc
      JOIN public.workspace_members wm ON wm.workspace_id = wc.workspace_id
      WHERE wc.creator_id = creators.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Campaign share links: remove public read-all policies
DROP POLICY IF EXISTS "Anyone can view share links" ON public.campaign_share_links;
DROP POLICY IF EXISTS "Public can view share links by token or owners can view their l" ON public.campaign_share_links;

-- Campaign share links: allow owners/admins only
DROP POLICY IF EXISTS "Campaign owners can view share links" ON public.campaign_share_links;
CREATE POLICY "Campaign owners can view share links"
  ON public.campaign_share_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns
      WHERE campaigns.id = campaign_share_links.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );

-- Workspace invites: restrict delete to admins/owners
DROP POLICY IF EXISTS "workspace_invites_delete_member" ON public.workspace_invites;
CREATE POLICY "workspace_invites_delete_admin"
  ON public.workspace_invites FOR DELETE
  USING (is_workspace_admin(workspace_id, auth.uid()));

-- Campaigns: enforce owner-only creation
DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert_workspace_editor" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert_editor_or_admin" ON public.campaigns;

-- Campaign creators: enforce owner-only add/remove
DROP POLICY IF EXISTS "campaign_creators_insert_workspace_editor" ON public.campaign_creators;
DROP POLICY IF EXISTS "campaign_creators_insert_editor_or_admin" ON public.campaign_creators;
DROP POLICY IF EXISTS "campaign_creators_delete_workspace_editor" ON public.campaign_creators;
DROP POLICY IF EXISTS "campaign_creators_delete_editor_or_admin" ON public.campaign_creators;
