# 🔧 Database Setup Fix

## The Problem

You're seeing this error:
```
Failed to create campaign: Could not find the table 'public.campaigns' in the schema cache
```

This means the database tables haven't been created yet in your Supabase project.

## Quick Fix (5 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Schema
1. Open the file `database/schema.sql` in this project
2. Copy **ALL** the contents (Ctrl+A / Cmd+A, then Ctrl+C / Cmd+C)
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify It Worked
1. In Supabase, go to **Table Editor** in the left sidebar
2. You should now see these tables:
   - ✅ `profiles`
   - ✅ `creators`
   - ✅ `campaigns` ← This is the one that was missing!
   - ✅ `posts`
   - ✅ `post_metrics`
   - ✅ `campaign_members`

### Step 4: Test the App
1. Go back to your app
2. Try creating a campaign again
3. It should work now! 🎉

## What the Schema Does

The `schema.sql` file creates:
- All database tables with proper structure
- Row Level Security (RLS) policies for data protection
- Automatic triggers for timestamps
- Storage bucket setup for campaign images
- Indexes for better performance

## Still Having Issues?

If you still see errors after running the schema:

1. **Check for errors in SQL Editor**: Look for any red error messages
2. **Verify your connection**: Make sure your `.env` file has the correct Supabase URL and key
3. **Check RLS policies**: The schema includes all necessary policies, but verify they were created
4. **Refresh your app**: Sometimes you need to refresh the browser after schema changes

## Need Help?

- Check `database/README.md` for more detailed setup instructions
- Check `PHASE_1_SETUP.md` for overall project setup



