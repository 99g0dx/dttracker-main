-- ============================================================
-- Combined Migration: Run All Migrations in Order
-- This file combines all migrations (001-009) for easy execution
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Migration 001: Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration 002: Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Migration 003: Add workspaces constraints and indexes
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.contype = 'u'
      AND n.nspname = 'public'
      AND t.relname = 'workspaces'
      AND c.conname = 'workspaces_name_unique'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_name_unique UNIQUE (name);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON public.workspaces (created_at);

-- Migration 004: Create/update team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role = ANY (ARRAY['owner','admin','member','viewer'])),
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active','pending'])),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active','pending'])),
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS joined_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_team_members_workspace_user ON public.team_members (workspace_id, user_id);

-- Migration 005: Add audit columns to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Migration 006: Enable RLS and policies for team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'team_members_self_select'
  ) THEN
    CREATE POLICY team_members_self_select ON public.team_members
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'team_members_workspace_insert'
  ) THEN
    CREATE POLICY team_members_workspace_insert ON public.team_members
      FOR INSERT TO authenticated
      WITH CHECK (
        workspace_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.workspace_id = team_members.workspace_id
            AND tm.user_id = (SELECT auth.uid())
            AND tm.role IN ('owner','admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'team_members_workspace_read'
  ) THEN
    CREATE POLICY team_members_workspace_read ON public.team_members
      FOR SELECT TO authenticated
      USING (
        workspace_id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.workspace_id = public.team_members.workspace_id
            AND tm.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END$$;

-- Migration 007: Enable RLS and policies for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_member_read'
  ) THEN
    CREATE POLICY workspaces_member_read ON public.workspaces
      FOR SELECT TO authenticated
      USING (
        id = (SELECT auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.workspace_id = public.workspaces.id
            AND tm.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_insert_owner_check'
  ) THEN
    CREATE POLICY workspaces_insert_owner_check ON public.workspaces
      FOR INSERT TO authenticated
      WITH CHECK (created_by = (SELECT auth.uid()));
  END IF;
END$$;

-- Migration 008: Create helper function
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.workspace_id = p_workspace_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin')
  ) OR p_workspace_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid) FROM anon, authenticated;

-- Migration 009: Create team_invites table with proper UUID function
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

CREATE INDEX IF NOT EXISTS idx_team_invites_workspace_id ON public.team_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(invite_token);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

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

-- Verification query - run this to check everything was created
SELECT 
  'Extension' as type, 
  extname as name 
FROM pg_extension 
WHERE extname = 'pgcrypto'
UNION ALL
SELECT 
  'Table' as type,
  table_name as name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('workspaces', 'team_members', 'team_invites')
UNION ALL
SELECT 
  'Function' as type,
  proname as name
FROM pg_proc
WHERE proname = 'is_workspace_admin';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ All migrations completed successfully!';
  RAISE NOTICE '✅ Tables created: workspaces, team_members, team_invites';
  RAISE NOTICE '✅ RLS enabled and policies created';
  RAISE NOTICE '✅ Helper function created: is_workspace_admin';
END$$;

