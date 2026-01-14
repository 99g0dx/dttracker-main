-- 014_drop_workspaces_table.sql
-- Purpose: Remove the workspaces table; workspace_id now maps directly to owner user_id.

DROP TABLE IF EXISTS public.workspaces CASCADE;

-- Keep helper for compatibility, but limit admin to owner only.
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT p_workspace_id = auth.uid();
$$;
