-- 019_reset_team_policies.sql
-- Purpose: Remove all existing team_members/team_invites policies and recreate a clean set.

-- Drop all policies on team_members
DROP POLICY IF EXISTS "Users can view team members in their workspace" ON public.team_members;
DROP POLICY IF EXISTS "Workspace owner can add team members" ON public.team_members;
DROP POLICY IF EXISTS "Workspace owner can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Workspace owner can remove team members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_from_invite_email" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_admins" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_admins" ON public.team_members;
DROP POLICY IF EXISTS "team_members_select_workspace" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_admins" ON public.team_members;

-- Drop all policies on team_invites
DROP POLICY IF EXISTS "Users can view invites for their workspace" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owner can create invites" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owner can update invites" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owner can delete invites" ON public.team_invites;
DROP POLICY IF EXISTS "Invited user can accept invite" ON public.team_invites;
DROP POLICY IF EXISTS "team_invites_delete_admins" ON public.team_invites;
DROP POLICY IF EXISTS "team_invites_insert_admins_only" ON public.team_invites;
DROP POLICY IF EXISTS "team_invites_select_admins_or_invited" ON public.team_invites;
DROP POLICY IF EXISTS "team_invites_update_admins_or_invited" ON public.team_invites;

-- Clean team_members policies (owner-as-workspace model)
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

-- Clean team_invites policies (owner-as-workspace model)
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
