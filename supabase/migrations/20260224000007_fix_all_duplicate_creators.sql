-- Fix All Duplicate Creators
-- This script merges all duplicate creators found in your database
-- Run this BEFORE running the normalization migration

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

-- Step 2: Check which tables exist (for conditional updates)
DO $$
DECLARE
  has_campaign_creators BOOLEAN;
  has_creator_request_items BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'campaign_creators'
  ) INTO has_campaign_creators;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'creator_request_items'
  ) INTO has_creator_request_items;
  
  -- Store in a temporary table for use in next DO block
  CREATE TEMP TABLE IF NOT EXISTS table_existence (
    has_campaign_creators BOOLEAN,
    has_creator_request_items BOOLEAN
  );
  
  DELETE FROM table_existence;
  INSERT INTO table_existence VALUES (has_campaign_creators, has_creator_request_items);
END $$;

-- Step 3: Merge all duplicates
DO $$
DECLARE
  dup_record RECORD;
  kept_id UUID;
  duplicate_ids UUID[];
  merged_count INT := 0;
  has_campaign_creators BOOLEAN;
  has_creator_request_items BOOLEAN;
BEGIN
  -- Get table existence info (use table alias to avoid ambiguity)
  SELECT te.has_campaign_creators, te.has_creator_request_items 
  INTO has_campaign_creators, has_creator_request_items
  FROM table_existence te
  LIMIT 1;
  
  -- Find all duplicate groups
  FOR dup_record IN
    SELECT 
      platform,
      normalize_creator_handle(handle) as normalized_handle,
      array_agg(id ORDER BY created_at) as creator_ids,
      array_agg(handle ORDER BY created_at) as handles
    FROM public.creators
    WHERE handle IS NOT NULL
    GROUP BY platform, normalize_creator_handle(handle)
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first (oldest) creator, merge others
    kept_id := dup_record.creator_ids[1];
    duplicate_ids := dup_record.creator_ids[2:array_length(dup_record.creator_ids, 1)];
    
    RAISE NOTICE 'Processing duplicates: platform=%, handle=%, keeping=%, merging=%', 
      dup_record.platform, 
      dup_record.normalized_handle,
      kept_id,
      duplicate_ids;
    
    -- Update references in posts table
    UPDATE public.posts
    SET creator_id = kept_id
    WHERE creator_id = ANY(duplicate_ids);
    
    -- Update references in workspace_creators table
    -- First, delete entries that would conflict
    DELETE FROM public.workspace_creators wc1
    WHERE wc1.creator_id = ANY(duplicate_ids)
      AND EXISTS (
        SELECT 1 FROM public.workspace_creators wc2
        WHERE wc2.workspace_id = wc1.workspace_id
          AND wc2.creator_id = kept_id
      );
    
    -- Now update the remaining entries
    UPDATE public.workspace_creators
    SET creator_id = kept_id
    WHERE creator_id = ANY(duplicate_ids);
    
    -- Update references in campaign_creators table (if it exists)
    IF has_campaign_creators THEN
      UPDATE public.campaign_creators
      SET creator_id = kept_id
      WHERE creator_id = ANY(duplicate_ids);
    END IF;
    
    -- Update references in creator_request_items table (if it exists)
    IF has_creator_request_items THEN
      UPDATE public.creator_request_items
      SET creator_id = kept_id
      WHERE creator_id = ANY(duplicate_ids);
    END IF;
    
    -- Delete duplicate creators (keep only the oldest)
    DELETE FROM public.creators
    WHERE id = ANY(duplicate_ids);
    
    merged_count := merged_count + array_length(duplicate_ids, 1);
    
    RAISE NOTICE 'Merged % duplicate creators for platform=%, handle=%', 
      array_length(duplicate_ids, 1), 
      dup_record.platform, 
      dup_record.normalized_handle;
  END LOOP;
  
  RAISE NOTICE 'Total duplicates merged: %', merged_count;
END $$;

-- Step 4: Normalize all remaining handles
UPDATE public.creators
SET handle = normalize_creator_handle(handle)
WHERE handle IS NOT NULL
  AND handle != normalize_creator_handle(handle);

-- Step 5: Verify no duplicates remain
SELECT 
  platform,
  normalize_creator_handle(handle) as normalized_handle,
  COUNT(*) as count
FROM public.creators
WHERE handle IS NOT NULL
GROUP BY platform, normalize_creator_handle(handle)
HAVING COUNT(*) > 1;

-- If the above query returns no rows, all duplicates have been fixed!
