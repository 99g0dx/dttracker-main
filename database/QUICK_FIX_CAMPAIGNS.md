# Quick Fix: Campaign Loading Error

## The Problem
You're seeing: **"Database table not found. Run database/schema.sql in Supabase SQL Editor."**

This means the `campaigns` table (and possibly other tables) don't exist in your Supabase database.

## Quick Fix (5 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Complete Schema
1. Open the file `database/schema.sql` in this project
2. Copy **ALL** the contents (Select All: Cmd+A / Ctrl+A, then Copy: Cmd+C / Ctrl+C)
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

**Important:** Make sure you copy the ENTIRE file - it's a large file with all tables, RLS policies, triggers, and indexes.

### Step 3: Verify Tables Were Created
1. In Supabase, go to **Table Editor** in the left sidebar
2. You should now see these tables:
   - ✅ `profiles`
   - ✅ `creators`
   - ✅ `campaigns` ← **This is the one that was missing!**
   - ✅ `posts`
   - ✅ `post_metrics`
   - ✅ `campaign_members`
   - ✅ `campaign_creators`
   - ✅ `campaign_share_links`
   - ✅ `creator_requests` (if you have Creator Request Flow)
   - ✅ `creator_request_items` (if you have Creator Request Flow)
   - ✅ `team_members`
   - ✅ `team_invites`

### Step 4: Verify RLS is Enabled
1. In Supabase, go to **Authentication** → **Policies**
2. Or check in **Table Editor** - each table should show "RLS Enabled" badge
3. If RLS is not enabled, the schema should have enabled it automatically

### Step 5: Test the App
1. Refresh your browser (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
2. Go to http://localhost:5173/campaigns
3. The error should be gone! 🎉

## If You Still See Errors

### Check for SQL Errors
1. Go back to SQL Editor in Supabase
2. Look for any red error messages
3. Common issues:
   - **"relation already exists"** - Tables already exist, this is OK, the script uses `CREATE TABLE IF NOT EXISTS`
   - **"permission denied"** - Make sure you're running as the database owner
   - **"function does not exist"** - Some functions need to be created first

### Verify Your Connection
1. Check your `.env` file has:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
2. Make sure these match your Supabase project settings

### Run Verification Script
1. In Supabase SQL Editor, create a new query
2. Copy and paste the contents of `database/verify_campaigns_table.sql`
3. Run it to check if tables and policies exist

## What the Schema Creates

The `schema.sql` file creates:
- ✅ All database tables with proper structure
- ✅ Row Level Security (RLS) policies for data protection
- ✅ Automatic triggers for `updated_at` timestamps
- ✅ Indexes for better query performance
- ✅ Storage bucket policies (if you have storage setup)
- ✅ Helper functions for timestamp management

## Still Having Issues?

1. **Check Supabase Logs**: Go to **Logs** → **Postgres Logs** to see detailed error messages
2. **Verify Project Settings**: Make sure you're in the correct Supabase project
3. **Check Browser Console**: Open DevTools (F12) and check for JavaScript errors
4. **Try Logging Out/In**: Sometimes authentication state needs to refresh

## Need More Help?

- See `DATABASE_SETUP_FIX.md` for more detailed instructions
- See `database/README.md` for comprehensive database setup guide
- Check `PHASE_1_SETUP.md` for overall project setup
