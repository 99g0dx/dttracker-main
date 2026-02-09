-- Quick Fix: Find and resolve duplicate creators
-- Run this if you're getting duplicate key errors

-- Step 1: Create normalization function if it doesn't exist
CREATE OR REPLACE FUNCTION normalize_creator_handle(handle_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF handle_value IS NULL OR TRIM(handle_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN LOWER(TRIM(REGEXP_REPLACE(handle_value, '^@+', '', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Fix specific duplicate for instagram/tweetsofchesky
-- Keeps the oldest creator and merges references
DO $$
DECLARE
  kept_id UUID;
  duplicate_ids UUID[];
BEGIN
  -- Find the oldest creator with this normalized handle
  SELECT id INTO kept_id
  FROM public.creators
  WHERE platform = 'instagram'
    AND normalize_creator_handle(handle) = 'tweetsofchesky'
  ORDER BY created_at
  LIMIT 1;

  IF kept_id IS NULL THEN
    RAISE NOTICE 'No creator found for instagram/tweetsofchesky';
    RETURN;
  END IF;

  -- Get all other duplicates
  SELECT array_agg(id) INTO duplicate_ids
  FROM public.creators
  WHERE platform = 'instagram'
    AND normalize_creator_handle(handle) = 'tweetsofchesky'
    AND id != kept_id;

  IF duplicate_ids IS NOT NULL AND array_length(duplicate_ids, 1) > 0 THEN
    -- Update posts to reference the kept creator
    UPDATE public.posts
    SET creator_id = kept_id
    WHERE creator_id = ANY(duplicate_ids);

    -- Remove workspace_creators rows that would conflict after re-pointing
    DELETE FROM public.workspace_creators wc
    WHERE wc.creator_id = ANY(duplicate_ids)
      AND EXISTS (
        SELECT 1 FROM public.workspace_creators wc2
        WHERE wc2.workspace_id = wc.workspace_id
          AND wc2.creator_id = kept_id
      );

    -- Re-point remaining workspace_creators to the kept creator
    UPDATE public.workspace_creators
    SET creator_id = kept_id
    WHERE creator_id = ANY(duplicate_ids);

    -- Delete campaign_creators conflicts then re-point
    DELETE FROM public.campaign_creators cc
    WHERE cc.creator_id = ANY(duplicate_ids)
      AND EXISTS (
        SELECT 1 FROM public.campaign_creators cc2
        WHERE cc2.campaign_id = cc.campaign_id
          AND cc2.creator_id = kept_id
      );

    UPDATE public.campaign_creators
    SET creator_id = kept_id
    WHERE creator_id = ANY(duplicate_ids);

    -- Delete duplicate creator rows
    DELETE FROM public.creators
    WHERE id = ANY(duplicate_ids);

    RAISE NOTICE 'Merged % duplicate creators, kept creator ID: %', array_length(duplicate_ids, 1), kept_id;
  ELSE
    RAISE NOTICE 'No duplicates found for instagram/tweetsofchesky';
  END IF;
END $$;

-- Step 3: Normalize the kept creator's handle
UPDATE public.creators
SET handle = normalize_creator_handle(handle)
WHERE platform = 'instagram'
  AND normalize_creator_handle(handle) = 'tweetsofchesky';
