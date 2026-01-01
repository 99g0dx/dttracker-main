-- 004_create_team_members.sql
-- Purpose: Create public.team_members table to map users to workspaces
-- Note: This migration ensures the table uses gen_random_uuid() if it needs to be recreated
-- The existing table structure is preserved with all current columns

-- Update existing team_members to use gen_random_uuid() if needed
-- (Only affects new rows if table already exists with uuid_generate_v4())

-- If table doesn't exist, create it with proper structure
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL, -- References workspaces(id) or user_id depending on model
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role = ANY (ARRAY['owner','admin','member','viewer'])),
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active','pending'])),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Add missing columns if they don't exist (for existing tables)
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active','pending'])),
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS joined_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_team_members_workspace_user ON public.team_members (workspace_id, user_id);

