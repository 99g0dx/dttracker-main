-- Operator access: allow agency_ops to write campaigns, posts, creators, post_metrics.
-- Extends workspace_editor policies to include agency_ops so operators can create campaigns,
-- share links, delete posts, trigger scrapes, export data, and manage creators.

-- Campaigns
DROP POLICY IF EXISTS campaigns_insert_workspace_editor ON public.campaigns;
CREATE POLICY campaigns_insert_workspace_editor
  ON public.campaigns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

DROP POLICY IF EXISTS campaigns_update_workspace_editor ON public.campaigns;
CREATE POLICY campaigns_update_workspace_editor
  ON public.campaigns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
    OR campaigns.created_by = auth.uid()
  );

DROP POLICY IF EXISTS campaigns_delete_workspace_editor ON public.campaigns;
CREATE POLICY campaigns_delete_workspace_editor
  ON public.campaigns
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
    OR campaigns.created_by = auth.uid()
  );

-- Posts
DROP POLICY IF EXISTS posts_write_workspace_editor ON public.posts;
CREATE POLICY posts_write_workspace_editor
  ON public.posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm
        ON wm.workspace_id = c.workspace_id
      WHERE c.id = posts.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

DROP POLICY IF EXISTS posts_update_workspace_editor ON public.posts;
CREATE POLICY posts_update_workspace_editor
  ON public.posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm
        ON wm.workspace_id = c.workspace_id
      WHERE c.id = posts.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

DROP POLICY IF EXISTS posts_delete_workspace_editor ON public.posts;
CREATE POLICY posts_delete_workspace_editor
  ON public.posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm
        ON wm.workspace_id = c.workspace_id
      WHERE c.id = posts.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

-- Post metrics
DROP POLICY IF EXISTS post_metrics_insert_workspace_editor ON public.post_metrics;
CREATE POLICY post_metrics_insert_workspace_editor
  ON public.post_metrics
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.campaigns c ON c.id = p.campaign_id
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE p.id = post_metrics.post_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

-- Campaign creators
DROP POLICY IF EXISTS campaign_creators_insert_workspace_editor ON public.campaign_creators;
CREATE POLICY campaign_creators_insert_workspace_editor
  ON public.campaign_creators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_creators.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

DROP POLICY IF EXISTS campaign_creators_delete_workspace_editor ON public.campaign_creators;
CREATE POLICY campaign_creators_delete_workspace_editor
  ON public.campaign_creators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_creators.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

-- Workspace creators
DROP POLICY IF EXISTS workspace_creators_insert ON public.workspace_creators;
CREATE POLICY workspace_creators_insert
  ON public.workspace_creators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );

DROP POLICY IF EXISTS workspace_creators_delete ON public.workspace_creators;
CREATE POLICY workspace_creators_delete
  ON public.workspace_creators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  );
