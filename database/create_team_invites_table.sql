-- ============================================================
-- Create team_invites table and RLS policies
-- Run this in Supabase SQL Editor if the table doesn't exist
-- ============================================================

-- 1. Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create team_invites table (matches TypeScript TeamInvite interface)
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'agency_ops' CHECK (role = ANY (ARRAY['brand_owner','agency_admin','brand_member','agency_ops'])),
  invite_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  message text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_invites_workspace_id ON public.team_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(invite_token);

-- 4. Enable Row Level Security
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (only create if they don't exist)
-- Policy: Users can view invites for their workspace
DO $$
BEGIN
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
END
$$;

-- Policy: Users can create invites in workspaces they own
DO $$
BEGIN
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
        AND team_members.role IN ('brand_owner', 'agency_admin')
      )
    );
  END IF;
END
$$;

-- Policy: Workspace owners/admins can update invites
DO $$
BEGIN
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
        AND team_members.role IN ('brand_owner', 'agency_admin')
      )
    );
  END IF;
END
$$;

-- Policy: Workspace owners/admins can delete/revoke invites
DO $$
BEGIN
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
        AND team_members.role IN ('brand_owner', 'agency_admin')
      )
    );
  END IF;
END
$$;

-- Verify the table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'team_invites'
ORDER BY ordinal_position;
