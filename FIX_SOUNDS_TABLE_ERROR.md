# Fix "Could not find the 'user_id' column" Error

## The Problem

You're getting this error:
```
"Could not find the 'user_id' column of 'sounds' in the schema cache"
```

This means either:
1. The `sounds` table doesn't exist
2. The `sounds` table exists but doesn't have the `user_id` column
3. There's a schema cache issue in Supabase

## Solution

### Step 1: Check if the Table Exists

Run this in Supabase SQL Editor:

```sql
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
```

**Expected result:** You should see columns including `id`, `user_id`, `platform`, `canonical_sound_key`, etc.

**If you see nothing:** The table doesn't exist → Go to Step 2

**If you see columns but NO `user_id`:** The table exists but is missing the column → Go to Step 3

### Step 2: Create the Table (If It Doesn't Exist)

Run this migration in Supabase SQL Editor:

```sql
-- Run: database/migrations/038_create_sounds_tables.sql
```

Or copy the entire file content from `database/migrations/038_create_sounds_tables.sql` and run it.

### Step 3: Add Missing Column (If Table Exists But Missing user_id)

If the table exists but is missing `user_id`, run:

```sql
-- Add user_id column if it doesn't exist
ALTER TABLE public.sounds 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make it NOT NULL (if you want to enforce it)
-- First, set a default for existing rows
UPDATE public.sounds 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Then make it NOT NULL
ALTER TABLE public.sounds 
ALTER COLUMN user_id SET NOT NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_sounds_user_id ON public.sounds(user_id);
```

### Step 4: Clear Schema Cache (If Issue Persists)

Sometimes Supabase caches the schema. Try:

1. **Wait 1-2 minutes** - Cache usually refreshes automatically
2. **Redeploy the Edge Function:**
   ```bash
   supabase functions deploy soundtrack_create_from_link
   ```
3. **Restart Supabase locally** (if using local dev):
   ```bash
   supabase stop
   supabase start
   ```

### Step 5: Verify the Fix

After running the migration, test again:

1. Go to your app
2. Try creating a sound track
3. Check Edge Function logs for success

## What I Changed

I updated `soundtrack_create_from_link` to:
1. ✅ **Try inserting with `user_id` first** (newer schema)
2. ✅ **Fall back to inserting without `user_id`** if column doesn't exist (older schema)
3. ✅ **Return helpful error messages** that tell you exactly which migration to run
4. ✅ **Handle all error cases gracefully**

## Quick Fix Script

If you want to quickly check and fix everything, run this in Supabase SQL Editor:

```sql
-- Quick check and fix for sounds table
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sounds'
  ) THEN
    RAISE NOTICE 'sounds table does not exist - run migration 038_create_sounds_tables.sql';
  ELSE
    -- Check if user_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'sounds'
        AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE 'user_id column missing - adding it...';
      ALTER TABLE public.sounds 
      ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      
      -- Set default for existing rows
      UPDATE public.sounds 
      SET user_id = (SELECT id FROM auth.users LIMIT 1)
      WHERE user_id IS NULL;
      
      -- Make NOT NULL
      ALTER TABLE public.sounds ALTER COLUMN user_id SET NOT NULL;
      
      -- Add index
      CREATE INDEX IF NOT EXISTS idx_sounds_user_id ON public.sounds(user_id);
      
      RAISE NOTICE 'user_id column added successfully';
    ELSE
      RAISE NOTICE 'sounds table exists and has user_id column - all good!';
    END IF;
  END IF;
END $$;
```

This script will tell you what's wrong and try to fix it automatically.
