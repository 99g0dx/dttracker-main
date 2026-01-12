# Run Migration: Add owner_workspace_id Column

## The Error
You're seeing: `"Failed to import creators: column creators.owner_workspace_id does not exist"`

This happens because the code expects the `owner_workspace_id` column to exist, but the database migration hasn't been run yet.

## Quick Fix (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration
1. Open the file `database/migrations/add_owner_workspace_id_to_creators.sql` in this project
2. Copy **ALL** the contents (Ctrl+A / Cmd+A, then Ctrl+C / Cmd+C)
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify It Worked
1. In Supabase, go to **Table Editor** in the left sidebar
2. Click on the `creators` table
3. You should now see a column called `owner_workspace_id`
4. All existing creators should have `owner_workspace_id` set to their `user_id`

### Step 4: Test the Import
1. Go back to your app
2. Try importing creators again
3. It should work now! ✅

## What the Migration Does

- Adds `owner_workspace_id UUID` column to `creators` table
- Sets `owner_workspace_id = user_id` for all existing creators (makes them "My Network")
- Creates an index for better query performance
- Safe to run multiple times (uses `IF NOT EXISTS`)

## Still Having Issues?

If you still see errors after running the migration:

1. **Check for errors in SQL Editor**: Look for any red error messages
2. **Verify the column exists**: Check Table Editor → creators table → look for `owner_workspace_id` column
3. **Refresh your app**: Sometimes you need to refresh the browser after schema changes
4. **Check RLS policies**: The migration doesn't change RLS, but verify creators table is accessible
