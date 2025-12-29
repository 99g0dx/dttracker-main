# Fix Schema Cache Error - Instructions

## Error Message
"Could not find the 'email' column of 'creators' in the schema cache"

## Quick Fix

### Step 1: Verify Current Schema
1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database/verify_creators_schema.sql`
4. Click **Run**
5. Check the results - it will show which columns are missing

### Step 2: Run the Migration
1. In **SQL Editor**, create a new query
2. Copy and paste the contents of `database/fix_creators_schema.sql`
3. Click **Run**
4. You should see: "Migration completed successfully!"

### Step 3: Refresh Schema Cache
After running the migration:
1. Wait 30-60 seconds for Supabase to refresh its schema cache
2. If the error persists, try:
   - Refreshing your browser
   - Making a small change to the table (add a comment column, then remove it)
   - Or wait a few more minutes

### Step 4: Verify Fix
1. Try saving a creator again
2. The error should be resolved
3. If not, run `database/verify_creators_schema.sql` again to confirm columns exist

## What This Migration Does

The migration script will:
- ✅ Add `email` column (TEXT)
- ✅ Add `phone` column (TEXT)
- ✅ Add `niche` column (TEXT)
- ✅ Add `location` column (TEXT)
- ✅ Add `source_type` column (with CHECK constraint)
- ✅ Add `imported_by_user_id` column (UUID, references auth.users)
- ✅ Set default values for existing rows
- ✅ Create indexes for performance
- ✅ Verify all columns were added successfully

## Alternative: Run Full Schema

If the migration doesn't work, you can run the full schema:
1. Go to **SQL Editor**
2. Copy and paste contents of `database/schema.sql`
3. Click **Run**
4. This will recreate everything (safe to run multiple times)

## Troubleshooting

### Error: "column already exists"
- This is fine! The script uses `IF NOT EXISTS` so it won't fail
- Just continue to the next step

### Error persists after migration
- Wait 2-3 minutes for cache refresh
- Try restarting your development server
- Check Supabase dashboard → Table Editor → creators table to verify columns exist

### Still having issues?
- Check that you're running the SQL in the correct Supabase project
- Verify your environment variables point to the right project
- Contact Supabase support if schema cache doesn't refresh after 5 minutes

