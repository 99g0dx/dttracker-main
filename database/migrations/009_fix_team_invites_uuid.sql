-- 009_fix_team_invites_uuid.sql
-- Purpose: Create team_invites table using gen_random_uuid() instead of uuid_generate_v4()
-- This matches the recommended pattern and ensures consistency across tables

-- Create team_invites table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member' CHECK (role = ANY (ARRAY['owner','admin','member','viewer'])),
  invite_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_invites_workspace_id ON public.team_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(invite_token);

-- Enable Row Level Security
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_invites
DO $$
BEGIN
  -- Policy: Users can view invites for their workspace
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_invites' 
    AND policyname = 'Users can view invites in their workspace'
  ) THEN
    CREATE POLICY "Users can view invites in their workspace"
    ON public.team_invites
    FOR SELECT
    TO authenticated
    USING (
      workspace_id = auth.uid() OR
      invited_by = auth.uid()
    );
  END IF;

  -- Policy: Users can create invites in workspaces they own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_invites' 
    AND policyname = 'Users can create invites in their workspace'
  ) THEN
    CREATE POLICY "Users can create invites in their workspace"
    ON public.team_invites
    FOR INSERT
    TO authenticated
    WITH CHECK (
      workspace_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = team_invites.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
      )
    );
  END IF;

  -- Policy: Workspace owners/admins can update invites
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_invites' 
    AND policyname = 'Workspace owners can update invites'
  ) THEN
    CREATE POLICY "Workspace owners can update invites"
    ON public.team_invites
    FOR UPDATE
    TO authenticated
    USING (
      workspace_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = team_invites.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
      )
    );
  END IF;

  -- Policy: Workspace owners/admins can delete/revoke invites
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'team_invites' 
    AND policyname = 'Workspace owners can delete invites'
  ) THEN
    CREATE POLICY "Workspace owners can delete invites"
    ON public.team_invites
    FOR DELETE
    TO authenticated
    USING (
      workspace_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = team_invites.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
      )
    );
  END IF;
END
$$;

