-- Update workspace roles to owner/admin/editor/viewer and align RLS policies.

-- 1) Update role constraints for workspace_members/workspace_invites.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.workspace_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workspace_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.workspace_invites'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workspace_invites DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.workspace_invites
  ADD CONSTRAINT workspace_invites_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));

-- 2) Migrate existing role values from member -> editor/viewer (based on scopes).
UPDATE public.workspace_members wm
SET role = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.member_scopes ms
    WHERE ms.team_member_id = wm.id
      AND ms.scope_type = 'workspace'
      AND ms.scope_value = 'editor'
  ) THEN 'editor'
  WHEN EXISTS (
    SELECT 1 FROM public.member_scopes ms
    WHERE ms.team_member_id = wm.id
      AND ms.scope_type = 'workspace'
      AND ms.scope_value = 'viewer'
  ) THEN 'viewer'
  ELSE 'viewer'
END
WHERE wm.role = 'member';

UPDATE public.workspace_invites wi
SET role = CASE
  WHEN wi.scopes @> '[{"scope_type":"workspace","scope_value":"editor"}]'::jsonb THEN 'editor'
  WHEN wi.scopes @> '[{"scope_type":"workspace","scope_value":"viewer"}]'::jsonb THEN 'viewer'
  ELSE 'viewer'
END
WHERE wi.role = 'member';

-- 3) Workspace members policies (owner/admin manage, editor write, viewer read).
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_select_member ON public.workspace_members;
CREATE POLICY workspace_members_select_member
  ON public.workspace_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS workspace_members_insert_owner ON public.workspace_members;
CREATE POLICY workspace_members_insert_owner
  ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
        AND w.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspace_members_insert_from_invite ON public.workspace_members;
CREATE POLICY workspace_members_insert_from_invite
  ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.workspace_invites wi
      WHERE wi.workspace_id = workspace_members.workspace_id
        AND wi.status = 'pending'
        AND wi.expires_at > now()
        AND lower(wi.email) = lower(
          COALESCE(
            auth.jwt() ->> 'email',
            (auth.jwt() -> 'user_metadata' ->> 'email'),
            (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS workspace_members_update_owner ON public.workspace_members;
CREATE POLICY workspace_members_update_owner
  ON public.workspace_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS workspace_members_delete_owner_or_self ON public.workspace_members;
CREATE POLICY workspace_members_delete_owner_or_self
  ON public.workspace_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- 4) Workspace invites policies.
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_invites_select_member ON public.workspace_invites;
CREATE POLICY workspace_invites_select_member
  ON public.workspace_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    OR lower(workspace_invites.email) = lower(
      COALESCE(
        auth.jwt() ->> 'email',
        (auth.jwt() -> 'user_metadata' ->> 'email'),
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS workspace_invites_insert_owner ON public.workspace_invites;
CREATE POLICY workspace_invites_insert_owner
  ON public.workspace_invites
  FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS workspace_invites_update_owner_or_invitee ON public.workspace_invites;
CREATE POLICY workspace_invites_update_owner_or_invitee
  ON public.workspace_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
    OR lower(workspace_invites.email) = lower(
      COALESCE(
        auth.jwt() ->> 'email',
        (auth.jwt() -> 'user_metadata' ->> 'email'),
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
    OR lower(workspace_invites.email) = lower(
      COALESCE(
        auth.jwt() ->> 'email',
        (auth.jwt() -> 'user_metadata' ->> 'email'),
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS workspace_invites_delete_owner ON public.workspace_invites;
CREATE POLICY workspace_invites_delete_owner
  ON public.workspace_invites
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- 5) Campaigns policies (workspace role-based).
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team view access" ON public.campaigns;
DROP POLICY IF EXISTS "Team create access" ON public.campaigns;
DROP POLICY IF EXISTS "Team update access" ON public.campaigns;
DROP POLICY IF EXISTS "Team delete access" ON public.campaigns;

CREATE POLICY campaigns_select_workspace
  ON public.campaigns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY campaigns_insert_workspace_editor
  ON public.campaigns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY campaigns_update_workspace_editor
  ON public.campaigns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'editor')
    )
    OR campaigns.created_by = auth.uid()
  );

CREATE POLICY campaigns_delete_workspace_editor
  ON public.campaigns
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = campaigns.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'editor')
    )
    OR campaigns.created_by = auth.uid()
  );

-- 6) Posts policies.
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view posts in campaigns they have access to" ON public.posts;
DROP POLICY IF EXISTS "Users can insert posts in campaigns they own or edit" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts in campaigns they own or edit" ON public.posts;
DROP POLICY IF EXISTS "Users can delete posts in campaigns they own or edit" ON public.posts;

CREATE POLICY posts_select_workspace
  ON public.posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm
        ON wm.workspace_id = c.workspace_id
      WHERE c.id = posts.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

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
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

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
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

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
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

-- 7) Post metrics policies.
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view post metrics for posts they have access to" ON public.post_metrics;
DROP POLICY IF EXISTS "Users can insert post metrics for posts they have access to" ON public.post_metrics;

CREATE POLICY post_metrics_select_workspace
  ON public.post_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.campaigns c ON c.id = p.campaign_id
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE p.id = post_metrics.post_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

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
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

-- 8) Campaign creators policies.
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view campaign_creators for campaigns they have access" ON public.campaign_creators;
DROP POLICY IF EXISTS "Users can insert campaign_creators for campaigns they own or ed" ON public.campaign_creators;
DROP POLICY IF EXISTS "Users can delete campaign_creators for campaigns they own or ed" ON public.campaign_creators;

CREATE POLICY campaign_creators_select_workspace
  ON public.campaign_creators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_creators.campaign_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

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
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

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
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

-- 9) Workspace creators policies.
ALTER TABLE public.workspace_creators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Users can insert their workspace creators" ON public.workspace_creators;
DROP POLICY IF EXISTS "Users can delete their workspace creators" ON public.workspace_creators;

CREATE POLICY workspace_creators_select
  ON public.workspace_creators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY workspace_creators_insert
  ON public.workspace_creators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY workspace_creators_delete
  ON public.workspace_creators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

-- 10) Account events policies.
ALTER TABLE public.account_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account owner can view events" ON public.account_events;
DROP POLICY IF EXISTS "Members can insert events" ON public.account_events;

CREATE POLICY account_events_select
  ON public.account_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = account_events.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY account_events_insert
  ON public.account_events
  FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = account_events.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- 11) Member scopes policies (owner/admin manage).
ALTER TABLE public.member_scopes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view scopes for team members in their workspace" ON public.member_scopes;
DROP POLICY IF EXISTS "Workspace owner can add scopes" ON public.member_scopes;
DROP POLICY IF EXISTS "Workspace owner can remove scopes" ON public.member_scopes;
DROP POLICY IF EXISTS "Invited user can add their scopes" ON public.member_scopes;

CREATE POLICY member_scopes_select
  ON public.member_scopes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.workspace_members tm ON tm.id = member_scopes.team_member_id
      WHERE wm.workspace_id = tm.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY member_scopes_insert
  ON public.member_scopes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.workspace_members tm ON tm.id = member_scopes.team_member_id
      WHERE wm.workspace_id = tm.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY member_scopes_delete
  ON public.member_scopes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.workspace_members tm ON tm.id = member_scopes.team_member_id
      WHERE wm.workspace_id = tm.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

-- 12) Profiles: allow workspace members to see each other (optional).
DROP POLICY IF EXISTS profiles_select_workspace_members ON public.profiles;
CREATE POLICY profiles_select_workspace_members
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members wm_self
      JOIN public.workspace_members wm_other
        ON wm_self.workspace_id = wm_other.workspace_id
      WHERE wm_self.user_id = auth.uid()
        AND wm_self.status = 'active'
        AND wm_other.user_id = profiles.id
        AND wm_other.status = 'active'
    )
  );
