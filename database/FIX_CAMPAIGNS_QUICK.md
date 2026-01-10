# 🔧 Quick Fix: Campaign Page Not Working After Supabase Setup

## The Problem

Even after running `schema.sql`, campaigns still don't load. This is because the `campaigns` table is missing several required columns that the application expects.

## Missing Columns

The campaigns table is missing:
1. **`parent_campaign_id`** - Required for subcampaigns functionality
2. **`share_enabled`** - Required for campaign sharing
3. **`share_token`** - Required for campaign sharing
4. **`share_created_at`** - Required for campaign sharing
5. **`share_expires_at`** - Required for campaign sharing
6. **`share_allow_export`** - Required for campaign sharing

## Quick Fix (2 minutes)

### Step 1: Run the Fix Script
1. Go to your Supabase project: https://app.supabase.com
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `database/fix_campaigns_missing_columns.sql` in this project
5. Copy **ALL** the contents
6. Paste into the Supabase SQL Editor
7. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

### Step 2: Verify It Worked
1. In Supabase, go to **Table Editor**
2. Click on the `campaigns` table
3. Click on the **Columns** tab or check the table structure
4. You should now see these columns:
   - ✅ `parent_campaign_id` (UUID, nullable)
   - ✅ `share_enabled` (boolean)
   - ✅ `share_token` (text, nullable, unique)
   - ✅ `share_created_at` (timestamp, nullable)
   - ✅ `share_expires_at` (timestamp, nullable)
   - ✅ `share_allow_export` (boolean)

### Step 3: Test Your App
1. Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Go to http://localhost:5173/campaigns
3. The campaigns should now load! 🎉

## What This Script Does

The fix script:
- ✅ Adds all missing columns to the `campaigns` table
- ✅ Creates the `parent_campaign_id` foreign key relationship
- ✅ Adds constraint to prevent self-referencing
- ✅ Creates indexes for better performance
- ✅ Adds validation triggers for subcampaigns
- ✅ Adds triggers to prevent posts on parent campaigns

## Alternative: Run Complete Schema Again

If you prefer, you can also:
1. Run the updated `schema.sql` file (which now includes all columns)
2. It uses `IF NOT EXISTS` so it's safe to re-run

## Still Having Issues?

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for any red error messages
4. The error message will tell you what's missing

### Check Supabase Logs
1. In Supabase, go to **Logs** → **Postgres Logs**
2. Look for any errors when the app tries to query campaigns
3. Common errors:
   - "column X does not exist" - Missing column (run fix script)
   - "permission denied" - RLS policy issue (verify RLS policies exist)
   - "relation does not exist" - Table doesn't exist (run schema.sql)

### Verify RLS Policies
1. In Supabase, go to **Authentication** → **Policies**
2. Find the `campaigns` table
3. You should see these policies:
   - "Users can view their own campaigns" (SELECT)
   - "Users can insert their own campaigns" (INSERT)
   - "Users can update their own campaigns" (UPDATE)
   - "Users can delete their own campaigns" (DELETE)

### Verify Authentication
1. Make sure you're logged in to the app
2. Check that your Supabase project URL and keys are correct in `.env`
3. Try logging out and logging back in
