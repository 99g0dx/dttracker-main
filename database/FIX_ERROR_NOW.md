# ⚡ URGENT FIX: Creator Requests Table Error

## The Error You're Seeing

```
Failed to submit request: Could not find the table 'public.creator_requests' in the schema cache
```

## The Fix (2 minutes)

### Step 1: Go to Supabase
1. Open https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Run the Fix Script
1. Open the file: `database/QUICK_SETUP_ALL_TABLES.sql`
2. Copy **ALL** the contents (Cmd+A / Ctrl+A, then Cmd+C / Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

**You should see:** "Success. No rows returned" or similar success message.

### Step 3: Verify It Worked
1. In Supabase, click **Table Editor** (left sidebar)
2. You should now see these tables:
   - ✅ `creator_requests` ← **This was missing!**
   - ✅ `creator_request_items`

### Step 4: Test Your App
1. Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Go back to Creator Library → All Creators tab
3. Select creators and click "Review Request"
4. Fill out the form and submit
5. **It should work now!** 🎉

## What This Script Does

- ✅ Creates the `creator_requests` table
- ✅ Creates the `creator_request_items` table  
- ✅ Sets up Row Level Security (RLS) policies
- ✅ Creates necessary indexes
- ✅ Sets up triggers for `updated_at` timestamps

## Troubleshooting

### Error: "permission denied"
- Make sure you're logged in as the project owner in Supabase
- Try running the script again

### Error: "relation already exists"
- This means the tables already exist (good!)
- You can ignore this error
- Check the Table Editor to confirm

### Still not working after running the script?
1. Check browser console (F12 → Console tab)
2. Look for any other error messages
3. Make sure you're authenticated in the app
4. Try logging out and back in

## Alternative: Use the Migration File

If `QUICK_SETUP_ALL_TABLES.sql` doesn't work, try:
1. Use `database/migrations/add_creator_requests.sql` instead
2. Follow the same steps above

---

**That's it!** Once you run the script, your Creator Request feature will work perfectly.
