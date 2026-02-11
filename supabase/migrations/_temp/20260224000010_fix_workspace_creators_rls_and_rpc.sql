-- 1. Widen workspace_creators INSERT policy to allow ANY active workspace member
--    (was restricted to brand_owner/agency_admin/brand_member/agency_ops only)
DROP POLICY IF EXISTS workspace_creators_insert ON public.workspace_creators;
CREATE POLICY workspace_creators_insert
  ON public.workspace_creators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_creators.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- 2. Create ensure_workspace_creator RPC (SECURITY DEFINER)
--    Bypasses RLS entirely so any authenticated user can add a creator
--    to their workspace without role-based INSERT restrictions.
CREATE OR REPLACE FUNCTION public.ensure_workspace_creator(
  p_workspace_id UUID,
  p_creator_id UUID,
  p_source TEXT DEFAULT 'manual'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT;
BEGIN
  v_source := CASE
    WHEN p_source IN ('scraper', 'csv', 'manual') THEN p_source
    WHEN p_source = 'scraper_extraction' THEN 'scraper'
    WHEN p_source = 'csv_import' THEN 'csv'
    ELSE 'manual'
  END;

  INSERT INTO public.workspace_creators (workspace_id, creator_id, source)
  VALUES (p_workspace_id, p_creator_id, v_source)
  ON CONFLICT (workspace_id, creator_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_workspace_creator(UUID, UUID, TEXT) TO authenticated;
