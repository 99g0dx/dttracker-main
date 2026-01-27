-- Check if sounds table exists and what columns it has
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sounds'
ORDER BY ordinal_position;

-- If table doesn't exist, run migration 038_create_sounds_tables.sql first
