-- ============================================================
-- Verify Creators Table Schema
-- Run this to check if all required columns exist
-- ============================================================

-- Check which columns exist in the creators table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creators'
ORDER BY ordinal_position;

-- Check for required columns
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'email'
    ) THEN '✓ email column exists'
    ELSE '✗ email column MISSING'
  END AS email_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'phone'
    ) THEN '✓ phone column exists'
    ELSE '✗ phone column MISSING'
  END AS phone_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'niche'
    ) THEN '✓ niche column exists'
    ELSE '✗ niche column MISSING'
  END AS niche_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'location'
    ) THEN '✓ location column exists'
    ELSE '✗ location column MISSING'
  END AS location_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'source_type'
    ) THEN '✓ source_type column exists'
    ELSE '✗ source_type column MISSING'
  END AS source_type_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'creators'
      AND column_name = 'imported_by_user_id'
    ) THEN '✓ imported_by_user_id column exists'
    ELSE '✗ imported_by_user_id column MISSING'
  END AS imported_by_user_id_status;




