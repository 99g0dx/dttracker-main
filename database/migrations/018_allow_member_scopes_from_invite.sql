-- 018_allow_member_scopes_from_invite.sql
-- Purpose: Allow invited users to insert their own member_scopes during invite acceptance.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_scopes'
      AND policyname='Invited user can add their scopes'
  ) THEN
    CREATE POLICY "Invited user can add their scopes"
      ON public.member_scopes
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.team_members tm
          WHERE tm.id = member_scopes.team_member_id
            AND tm.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM public.team_invites ti
          WHERE ti.workspace_id = (
            SELECT tm.workspace_id
            FROM public.team_members tm
            WHERE tm.id = member_scopes.team_member_id
          )
            AND ti.email = (auth.jwt() ->> 'email')
            AND ti.accepted_at IS NULL
            AND ti.expires_at > now()
        )
      );
  END IF;
END
$$;
