# 🔧 Quick Fix: Creator Requests Table Missing

## The Problem

You're seeing this error:
```
Failed to submit request: Could not find the table 'public.creator_requests' in the schema cache
```

This means the `creator_requests` and `creator_request_items` tables haven't been created in your Supabase database yet.

## Quick Fix (2 minutes)

### Step 1: Run the Creator Requests Migration
1. Go to your Supabase project: https://app.supabase.com
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `database/migrations/add_creator_requests.sql` in this project
5. Copy **ALL** the contents
6. Paste into the Supabase SQL Editor
7. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

**OR** if that file doesn't work, use `database/fix_creator_requests_quick.sql` (see Step 2)

### Step 2: Verify It Worked
1. In Supabase, go to **Table Editor** in the left sidebar
2. You should now see these tables:
   - ✅ `creator_requests` ← **This is the one that was missing!**
   - ✅ `creator_request_items`
3. Click on `creator_requests` to verify it has these columns:
   - `id`, `user_id`, `status`, `campaign_type`, `campaign_brief`, etc.

### Step 3: Test Your App
1. Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Go to http://localhost:5173/creators
3. Switch to "All Creators" tab
4. Select some creators and click "Review Request"
5. Fill out the form and submit
6. It should work now! 🎉

## What These Tables Do

- **`creator_requests`**: Stores the main request information (campaign type, brief, deliverables, etc.)
- **`creator_request_items`**: Links selected creators to requests (many-to-many relationship)

## Still Having Issues?

### Check for SQL Errors
1. Go back to SQL Editor in Supabase
2. Look for any red error messages
3. Common issues:
   - **"relation already exists"** - Tables already exist, this is OK
   - **"permission denied"** - Make sure you're running as the database owner
   - **"function does not exist"** - Some helper functions need to be created first

### Verify RLS is Enabled
1. In Supabase, go to **Table Editor**
2. Click on `creator_requests` table
3. Check that it shows "RLS Enabled" badge
4. If not, RLS policies might not have been created

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for more detailed error messages
4. The error will tell you what's specifically wrong
