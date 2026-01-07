-- ============================================================
-- Fix Creators Table Schema - Add Missing Columns
-- This script fixes the "Could not find the 'email' column" error
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add email column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Add phone column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Step 3: Add niche column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS niche TEXT;

-- Step 4: Add location column if it doesn't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Step 5: Add source_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'creators' 
    AND column_name = 'source_type'
  ) THEN
    ALTER TABLE public.creators 
    ADD COLUMN source_type TEXT CHECK (source_type IN ('manual', 'csv_import', 'scraper_extraction')) DEFAULT 'manual';
  END IF;
END $$;

-- Step 6: Set default value for existing rows
UPDATE public.creators 
SET source_type = 'manual' 
WHERE source_type IS NULL;

-- Step 7: Add imported_by_user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'creators' 
    AND column_name = 'imported_by_user_id'
  ) THEN
    ALTER TABLE public.creators 
    ADD COLUMN imported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 8: Set imported_by_user_id to user_id for existing creators
UPDATE public.creators 
SET imported_by_user_id = user_id 
WHERE imported_by_user_id IS NULL;

-- Step 9: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_creators_source_type ON public.creators(source_type);
CREATE INDEX IF NOT EXISTS idx_creators_location ON public.creators(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creators_imported_by_user_id ON public.creators(imported_by_user_id) WHERE imported_by_user_id IS NOT NULL;

-- Step 10: Verify all columns exist (this will show an error if something is wrong)
DO $$
DECLARE
  missing_columns TEXT[];
BEGIN
  SELECT array_agg(column_name) INTO missing_columns
  FROM (
    SELECT unnest(ARRAY['email', 'phone', 'niche', 'location', 'source_type', 'imported_by_user_id']) AS column_name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'creators'
    AND information_schema.columns.column_name = expected.column_name
  );
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Missing columns: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE 'All required columns exist in creators table';
  END IF;
END $$;

-- Success message
SELECT 'Migration completed successfully! All columns have been added to the creators table.' AS status;




