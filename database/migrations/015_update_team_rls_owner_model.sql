-- 015_update_team_rls_owner_model.sql
-- Purpose: Enforce owner-as-workspace model for team_members and team_invites.

-- Team members policies
DROP POLICY IF EXISTS "Users can view team members in their workspace" ON public.team_members;
DROP POLICY IF EXISTS "Workspace owner can add team members" ON public.team_members;
DROP POLICY IF EXISTS "Workspace owner can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Workspace owner can remove team members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_from_invite_email" ON public.team_members;

CREATE POLICY "Users can view team members in their workspace"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (workspace_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Workspace owner can add team members"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = auth.uid() AND invited_by = auth.uid());

CREATE POLICY "team_members_insert_from_invite_email"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.team_invites ti
      WHERE ti.workspace_id = team_members.workspace_id
        AND ti.email = (auth.jwt() ->> 'email')
        AND ti.accepted_at IS NULL
        AND ti.expires_at > now()
    )
  );

CREATE POLICY "Workspace owner can update team members"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (workspace_id = auth.uid())
  WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can remove team members"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (workspace_id = auth.uid());

-- Team invites policies
DROP POLICY IF EXISTS "Users can view invites for their workspace" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owner can create invites" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owner can update invites or public can accept" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owner can delete invites" ON public.team_invites;

CREATE POLICY "Users can view invites for their workspace"
  ON public.team_invites
  FOR SELECT
  TO authenticated
  USING (workspace_id = auth.uid() OR email = (auth.jwt() ->> 'email'));

CREATE POLICY "Workspace owner can create invites"
  ON public.team_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = auth.uid() AND invited_by = auth.uid());

CREATE POLICY "Workspace owner can update invites"
  ON public.team_invites
  FOR UPDATE
  TO authenticated
  USING (workspace_id = auth.uid())
  WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Invited user can accept invite"
  ON public.team_invites
  FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email') AND accepted_at IS NULL)
  WITH CHECK (email = (auth.jwt() ->> 'email') AND accepted_at IS NOT NULL);

CREATE POLICY "Workspace owner can delete invites"
  ON public.team_invites
  FOR DELETE
  TO authenticated
  USING (workspace_id = auth.uid());
