-- Quick Fix: Find and resolve duplicate creators
-- Run this if you're getting duplicate key errors

-- Step 1: Check for duplicates
SELECT 
  platform,
  normalize_creator_handle(handle) as normalized_handle,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at) as creator_ids,
  array_agg(handle ORDER BY created_at) as handles
FROM public.creators
WHERE handle IS NOT NULL
GROUP BY platform, normalize_creator_handle(handle)
HAVING COUNT(*) > 1;

-- Step 2: Create normalization function if it doesn't exist
CREATE OR REPLACE FUNCTION normalize_creator_handle(handle_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF handle_value IS NULL OR TRIM(handle_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN LOWER(TRIM(REGEXP_REPLACE(handle_value, '^@+', '', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Fix specific duplicate (replace 'tweetsofchesky' and 'instagram' with your values)
-- This keeps the oldest creator and merges references
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
    
    -- Update workspace_creators (handle conflicts)
    UPDATE public.workspace_creators
    SET creator_id = kept_id
    WHERE creator_id = ANY(duplicate_ids)
    ON CONFLICT (workspace_id, creator_id) DO NOTHING;
    
    -- Delete duplicates
    DELETE FROM public.creators
    WHERE id = ANY(duplicate_ids);
    
    RAISE NOTICE 'Merged % duplicate creators, kept creator ID: %', array_length(duplicate_ids, 1), kept_id;
  ELSE
    RAISE NOTICE 'No duplicates found for instagram/tweetsofchesky';
  END IF;
END $$;

-- Step 4: Normalize the kept creator's handle
UPDATE public.creators
SET handle = normalize_creator_handle(handle)
WHERE platform = 'instagram'
  AND normalize_creator_handle(handle) = 'tweetsofchesky';
