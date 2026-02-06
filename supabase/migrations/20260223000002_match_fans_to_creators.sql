-- Migration: Create RPC function to match community fans to creators
-- Matches fans to creators by handle + platform (case-insensitive, @ removal)

-- Helper function to normalize handle (lowercase, remove @)
CREATE OR REPLACE FUNCTION normalize_handle(p_handle TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(COALESCE(p_handle, ''), '^@+', '', 'g')));
END;
$$;

-- RPC function to match community fans to creators
CREATE OR REPLACE FUNCTION match_community_fans_to_creators(
  p_workspace_id UUID
)
RETURNS TABLE(
  matched_count INTEGER,
  unmatched_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matched INTEGER := 0;
  v_unmatched INTEGER := 0;
  v_fan RECORD;
  v_creator_id UUID;
BEGIN
  -- Loop through all fans in workspace that don't have a creator_id yet
  FOR v_fan IN
    SELECT id, handle, platform, workspace_id
    FROM public.community_fans
    WHERE workspace_id = p_workspace_id
    AND creator_id IS NULL
  LOOP
    -- Try to find matching creator by normalized handle + platform
    SELECT id INTO v_creator_id
    FROM public.creators
    WHERE normalize_handle(handle) = normalize_handle(v_fan.handle)
    AND platform = v_fan.platform
    LIMIT 1;

    -- If match found, update fan
    IF v_creator_id IS NOT NULL THEN
      UPDATE public.community_fans
      SET creator_id = v_creator_id,
          updated_at = NOW()
      WHERE id = v_fan.id;
      v_matched := v_matched + 1;
    ELSE
      v_unmatched := v_unmatched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched, v_unmatched;
END;
$$;

-- Function to match a single fan to creators (useful for triggers)
CREATE OR REPLACE FUNCTION match_single_fan_to_creator(
  p_fan_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fan RECORD;
  v_creator_id UUID;
BEGIN
  -- Get fan details
  SELECT id, handle, platform, creator_id
  INTO v_fan
  FROM public.community_fans
  WHERE id = p_fan_id;

  -- If fan not found or already matched, return
  IF v_fan IS NULL OR v_fan.creator_id IS NOT NULL THEN
    RETURN v_fan.creator_id;
  END IF;

  -- Try to find matching creator
  SELECT id INTO v_creator_id
  FROM public.creators
  WHERE normalize_handle(handle) = normalize_handle(v_fan.handle)
  AND platform = v_fan.platform
  LIMIT 1;

  -- If match found, update fan
  IF v_creator_id IS NOT NULL THEN
    UPDATE public.community_fans
    SET creator_id = v_creator_id,
        updated_at = NOW()
    WHERE id = p_fan_id;
  END IF;

  RETURN v_creator_id;
END;
$$;

-- Function to match creators to fans (reverse direction - when creator is created)
CREATE OR REPLACE FUNCTION match_creator_to_fans(
  p_creator_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator RECORD;
  v_matched INTEGER := 0;
BEGIN
  -- Get creator details
  SELECT id, handle, platform
  INTO v_creator
  FROM public.creators
  WHERE id = p_creator_id;

  IF v_creator IS NULL THEN
    RETURN 0;
  END IF;

  -- Update all matching fans in all workspaces
  UPDATE public.community_fans
  SET creator_id = v_creator.id,
      updated_at = NOW()
  WHERE creator_id IS NULL
  AND normalize_handle(handle) = normalize_handle(v_creator.handle)
  AND platform = v_creator.platform;

  GET DIAGNOSTICS v_matched = ROW_COUNT;
  RETURN v_matched;
END;
$$;

-- Add index for efficient matching queries
CREATE INDEX IF NOT EXISTS idx_community_fans_creator_handle_platform 
ON public.community_fans(workspace_id, platform, creator_id) 
WHERE creator_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_creators_handle_platform_normalized
ON public.creators(platform, LOWER(TRIM(REGEXP_REPLACE(COALESCE(handle, ''), '^@+', '', 'g'))));

-- Trigger function for auto-matching when fan is inserted
CREATE OR REPLACE FUNCTION trigger_match_fan_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Try to match the new fan to a creator
  PERFORM match_single_fan_to_creator(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger function for auto-matching when creator is inserted/updated
CREATE OR REPLACE FUNCTION trigger_match_creator_to_fans()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Match this creator to any unmatched fans
  PERFORM match_creator_to_fans(NEW.id);
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS match_fan_on_insert ON public.community_fans;
CREATE TRIGGER match_fan_on_insert
  AFTER INSERT ON public.community_fans
  FOR EACH ROW
  WHEN (NEW.creator_id IS NULL)
  EXECUTE FUNCTION trigger_match_fan_on_insert();

DROP TRIGGER IF EXISTS match_creator_to_fans_on_insert ON public.creators;
CREATE TRIGGER match_creator_to_fans_on_insert
  AFTER INSERT ON public.creators
  FOR EACH ROW
  EXECUTE FUNCTION trigger_match_creator_to_fans();

DROP TRIGGER IF EXISTS match_creator_to_fans_on_update ON public.creators;
CREATE TRIGGER match_creator_to_fans_on_update
  AFTER UPDATE OF handle, platform ON public.creators
  FOR EACH ROW
  WHEN (OLD.handle IS DISTINCT FROM NEW.handle OR OLD.platform IS DISTINCT FROM NEW.platform)
  EXECUTE FUNCTION trigger_match_creator_to_fans();

-- Add comments
COMMENT ON FUNCTION match_community_fans_to_creators(UUID) IS 
'Matches all unmatched community fans in a workspace to creators by handle + platform. Returns counts of matched and unmatched fans.';

COMMENT ON FUNCTION match_single_fan_to_creator(UUID) IS 
'Matches a single fan to a creator by handle + platform. Returns the matched creator_id or NULL.';

COMMENT ON FUNCTION match_creator_to_fans(UUID) IS 
'Matches a creator to all unmatched fans across all workspaces by handle + platform. Returns count of matched fans.';
