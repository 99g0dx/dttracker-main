-- Migration: Normalize creator handles and add trigger to prevent duplicates
-- This ensures handles are always stored in normalized form (lowercase, no @ prefix)
-- and prevents duplicate key errors due to case/handle format mismatches
-- NOTE: Run the fix_all_duplicate_creators.sql migration FIRST to merge existing duplicates

-- Step 1: Create function to normalize handle
CREATE OR REPLACE FUNCTION normalize_creator_handle(handle_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF handle_value IS NULL OR TRIM(handle_value) = '' THEN
    RETURN NULL;
  END IF;
  -- Remove @ prefix and convert to lowercase
  RETURN LOWER(TRIM(REGEXP_REPLACE(handle_value, '^@+', '', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Normalize all existing handles
-- (Duplicates should already be fixed by the previous migration)
UPDATE public.creators
SET handle = normalize_creator_handle(handle)
WHERE handle IS NOT NULL
  AND handle != normalize_creator_handle(handle);

-- Step 3: Create trigger function to normalize handle before insert/update
CREATE OR REPLACE FUNCTION trigger_normalize_creator_handle()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize handle before insert/update
  NEW.handle = normalize_creator_handle(NEW.handle);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS normalize_creator_handle_trigger ON public.creators;

CREATE TRIGGER normalize_creator_handle_trigger
  BEFORE INSERT OR UPDATE OF handle ON public.creators
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_creator_handle();

-- Step 5: Add comment explaining the normalization
COMMENT ON FUNCTION normalize_creator_handle IS 'Normalizes creator handles by removing @ prefix and converting to lowercase. Used to ensure consistent storage and prevent duplicate key errors.';
COMMENT ON FUNCTION trigger_normalize_creator_handle IS 'Trigger function that automatically normalizes creator handles on insert/update to prevent duplicates due to case or @ prefix differences.';
