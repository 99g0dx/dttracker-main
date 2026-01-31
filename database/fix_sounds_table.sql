-- ============================================================
-- FIX SOUNDS TABLE: Check and Fix Missing user_id Column
-- ============================================================
-- Run this in Supabase SQL Editor to check if sounds table
-- exists and has the user_id column. If not, it will fix it.
-- ============================================================

DO $$
DECLARE
  col RECORD;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sounds'
  ) THEN
    RAISE NOTICE '❌ sounds table does not exist';
    RAISE NOTICE '📝 Please run: database/migrations/038_create_sounds_tables.sql';
  ELSE
    RAISE NOTICE '✅ sounds table exists';
    
    -- Check if user_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'sounds'
        AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE '⚠️  user_id column missing - adding it...';
      
      -- Add user_id column
      ALTER TABLE public.sounds 
      ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      
      -- Set default for existing rows (use first user or workspace owner)
      UPDATE public.sounds 
      SET user_id = (
        SELECT id FROM auth.users 
        ORDER BY created_at 
        LIMIT 1
      )
      WHERE user_id IS NULL;
      
      -- Make NOT NULL (only if we have users)
      IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
        ALTER TABLE public.sounds ALTER COLUMN user_id SET NOT NULL;
      END IF;
      
      -- Add index
      CREATE INDEX IF NOT EXISTS idx_sounds_user_id ON public.sounds(user_id);
      
      RAISE NOTICE '✅ user_id column added successfully';
    ELSE
      RAISE NOTICE '✅ user_id column exists - all good!';
    END IF;
    
    -- Show current columns
    RAISE NOTICE '';
    RAISE NOTICE '📋 Current sounds table columns:';
    FOR col IN (
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'sounds'
      ORDER BY ordinal_position
    ) LOOP
      RAISE NOTICE '   - % (%) %', 
        col.column_name::text, 
        col.data_type::text,
        CASE WHEN col.is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END;
    END LOOP;
  END IF;
END $$;

-- Also check if the table needs the full migration
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'sounds'
    ) THEN '❌ Table does not exist - run migration 038_create_sounds_tables.sql'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'sounds'
        AND column_name = 'user_id'
    ) THEN '⚠️  user_id column missing - run the DO block above to fix'
    ELSE '✅ Table exists with user_id column'
  END AS status;
