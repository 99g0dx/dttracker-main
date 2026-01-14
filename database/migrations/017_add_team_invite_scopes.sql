-- 017_add_team_invite_scopes.sql
-- Purpose: Store invite scopes on team_invites to apply on acceptance.

ALTER TABLE public.team_invites
ADD COLUMN IF NOT EXISTS scopes JSONB DEFAULT '[]'::jsonb;
