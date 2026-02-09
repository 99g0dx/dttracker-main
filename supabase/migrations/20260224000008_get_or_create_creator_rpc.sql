-- RPC to get-or-create a creator by (platform, handle) AND ensure they are
-- in the caller's workspace_creators. Runs as SECURITY DEFINER to bypass RLS
-- on both creators (SELECT-only for workspace members) and workspace_creators
-- (INSERT restricted to specific roles).
CREATE OR REPLACE FUNCTION public.get_or_create_creator(
  p_platform TEXT,
  p_handle TEXT,
  p_name TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_follower_count INT DEFAULT 0,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_niche TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT 'manual',
  p_imported_by_user_id UUID DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_normalized_handle TEXT;
  v_source TEXT;
BEGIN
  -- Normalize handle: strip @, lowercase, trim
  v_normalized_handle := LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_handle, ''), '^@+', '', 'g')));

  -- Try to find existing creator
  SELECT id INTO v_creator_id
  FROM public.creators
  WHERE platform = p_platform
    AND LOWER(handle) = v_normalized_handle
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    -- Create new creator
    INSERT INTO public.creators (
      platform, handle, name, user_id,
      follower_count, avg_engagement,
      email, phone, niche, location,
      source_type, imported_by_user_id
    ) VALUES (
      p_platform, v_normalized_handle, COALESCE(p_name, v_normalized_handle), p_user_id,
      COALESCE(p_follower_count, 0), 0,
      p_email, p_phone, p_niche, p_location,
      COALESCE(p_source_type, 'manual'), p_imported_by_user_id
    )
    ON CONFLICT (platform, handle) DO NOTHING
    RETURNING id INTO v_creator_id;

    -- If ON CONFLICT hit, fetch existing
    IF v_creator_id IS NULL THEN
      SELECT id INTO v_creator_id
      FROM public.creators
      WHERE platform = p_platform
        AND LOWER(handle) = v_normalized_handle
      LIMIT 1;
    END IF;
  END IF;

  -- Ensure creator is in workspace_creators (bypasses RLS)
  IF v_creator_id IS NOT NULL AND p_workspace_id IS NOT NULL THEN
    v_source := CASE
      WHEN p_source_type = 'scraper_extraction' THEN 'scraper'
      WHEN p_source_type = 'csv_import' THEN 'csv'
      ELSE 'manual'
    END;

    INSERT INTO public.workspace_creators (workspace_id, creator_id, source)
    VALUES (p_workspace_id, v_creator_id, v_source)
    ON CONFLICT (workspace_id, creator_id) DO NOTHING;
  END IF;

  RETURN v_creator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_creator(TEXT, TEXT, TEXT, UUID, INT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;
