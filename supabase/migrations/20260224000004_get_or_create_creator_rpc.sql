-- RPC to get-or-create a creator by (platform, handle), bypassing RLS visibility
-- restrictions. This is needed because the creators table has RLS that limits
-- SELECT to workspace members, so a user can't see a creator from another
-- workspace. But the unique index on (platform, handle) prevents creating a
-- duplicate, leaving the user stuck.
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
  p_imported_by_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_normalized_handle TEXT;
BEGIN
  -- Normalize handle: strip @, lowercase, trim
  v_normalized_handle := LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_handle, ''), '^@+', '', 'g')));

  -- Try to find existing creator
  SELECT id INTO v_creator_id
  FROM public.creators
  WHERE platform = p_platform
    AND LOWER(handle) = v_normalized_handle
  LIMIT 1;

  IF v_creator_id IS NOT NULL THEN
    RETURN v_creator_id;
  END IF;

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

  -- If ON CONFLICT hit, the INSERT returned nothing; fetch existing
  IF v_creator_id IS NULL THEN
    SELECT id INTO v_creator_id
    FROM public.creators
    WHERE platform = p_platform
      AND LOWER(handle) = v_normalized_handle
    LIMIT 1;
  END IF;

  RETURN v_creator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_creator(TEXT, TEXT, TEXT, UUID, INT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
