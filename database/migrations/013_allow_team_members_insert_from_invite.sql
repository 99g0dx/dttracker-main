-- 013_allow_team_members_insert_from_invite.sql
-- Purpose: Allow invited users to insert their team_members row when accepting an invite.
-- This avoids recursion by checking team_invites instead of team_members.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members'
      AND policyname = 'team_members_insert_from_invite_email'
  ) THEN
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
  END IF;
END
$$;
