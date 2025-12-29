# Campaign Save Troubleshooting Guide

If campaigns are failing to save, follow these steps to diagnose and fix the issue.

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. Try creating a campaign again
4. Look for any error messages - they will now be more detailed

## Step 2: Verify RLS Policies

The most common issue is missing Row Level Security (RLS) policies. Even though tables exist, policies might not have been created.

### Check in Supabase Dashboard:

1. Go to **Authentication** → **Policies** in your Supabase dashboard
2. Select the `campaigns` table from the dropdown
3. You should see these policies:
   - ✅ "Users can view their own campaigns and shared campaigns" (SELECT)
   - ✅ "Users can insert their own campaigns" (INSERT) ← **This is critical!**
   - ✅ "Users can update their own campaigns or campaigns they are editors of" (UPDATE)
   - ✅ "Users can delete their own campaigns" (DELETE)

### If Policies Are Missing:

1. Go to **SQL Editor** in Supabase
2. Copy and run **only the INSERT policy section** from `database/schema.sql`:

```sql
-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaigns'
      AND policyname='Users can insert their own campaigns'
  ) THEN
    CREATE POLICY "Users can insert their own campaigns"
      ON public.campaigns FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
```

## Step 3: Verify Authentication

Make sure you're logged in:

1. Check that you can see your user profile
2. In browser console, run:
   ```javascript
   // Check if you're authenticated
   const { data: { user } } = await supabase.auth.getUser();
   console.log('Current user:', user);
   ```
3. If `user` is `null`, you need to log in again

## Step 4: Check Required Fields

The campaign form requires:
- ✅ Campaign Name (required)
- ✅ Brand Name (required)
- ⚪ Start Date (optional)
- ⚪ End Date (optional)
- ⚪ Notes (optional)
- ⚪ Cover Image (optional)

Make sure both required fields are filled in.

## Step 5: Check Storage Bucket (if uploading image)

If you're uploading a cover image and it fails:

1. Go to **Storage** in Supabase dashboard
2. Check if `campaign-covers` bucket exists
3. If not:
   - Click **New Bucket**
   - Name: `campaign-covers`
   - Set to **Public**
   - Click **Create bucket**
4. Then run the storage policies SQL from `database/schema.sql` (lines 680-753)

## Step 6: Test with Minimal Data

Try creating a campaign with just:
- Campaign Name: "Test Campaign"
- Brand Name: "Test Brand"
- No dates, no notes, no image

If this works, the issue is likely with one of the optional fields.

## Step 7: Check Database Constraints

The schema has these constraints on the `campaigns` table:
- `status` must be one of: 'active', 'paused', 'completed', 'archived'
- `user_id` must reference a valid user

The code should handle these automatically, but if you see constraint errors, check:
1. That you're logged in with a valid user
2. That the status is set to 'active' (default)

## Common Error Messages & Solutions

### "Permission denied" or "policy"
→ **Solution**: RLS policies are missing. Run the INSERT policy SQL from Step 2.

### "Bucket not found"
→ **Solution**: Create the `campaign-covers` storage bucket (Step 5).

### "Not authenticated"
→ **Solution**: Log out and log back in.

### "violates constraint" or "constraint"
→ **Solution**: Check that all required fields are valid and the user is authenticated.

### "schema cache" or "does not exist"
→ **Solution**: Tables are missing. Run the full `database/schema.sql` file.

## Still Having Issues?

1. Check the browser console for the full error message
2. Check the Network tab in Developer Tools to see the actual API request/response
3. Verify your Supabase project URL and API key in `.env` file
4. Make sure you're using the correct Supabase project (not a different one)

## Quick Fix: Re-run Schema

If nothing else works, re-run the entire schema:

1. Go to **SQL Editor** in Supabase
2. Copy the entire `database/schema.sql` file
3. Paste and run it
4. It's safe to re-run - it uses `IF NOT EXISTS` checks



