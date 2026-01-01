-- 002_create_workspaces.sql
-- Purpose: Create public.workspaces table (id, name, created_at)
-- Note: This creates a proper workspaces table. Current code uses workspace_id = user_id,
-- but this table allows future migration to proper multi-workspace support.

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

