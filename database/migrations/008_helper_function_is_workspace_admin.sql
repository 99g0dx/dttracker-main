-- 008_helper_function_is_workspace_admin.sql
-- Purpose: Create helper function is_workspace_admin(uuid) for permission checks

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.workspace_id = p_workspace_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin')
  ) OR p_workspace_id = auth.uid(); -- Support current model: workspace_id = user_id
$$;

-- Revoke execute from anon/authenticated to prevent direct client-side use
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid) FROM anon, authenticated;

