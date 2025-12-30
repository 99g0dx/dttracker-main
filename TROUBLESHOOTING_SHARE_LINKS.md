# Troubleshooting Share Links Not Loading

## Common Issues and Solutions

### 1. "Campaign not found" or Blank Page

**Cause**: The RLS (Row Level Security) policies haven't been applied to allow public access.

**Solution**: Run the SQL migration script in your Supabase dashboard:

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `database/add_share_link_public_access.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

This script adds policies that allow:
- Anonymous users to view campaigns with valid share links
- Anonymous users to view posts for those campaigns
- Anonymous users to view creators when viewing posts
- Anonymous users to view post_metrics for charts

### 2. Browser Console Errors

Check your browser's developer console (F12) for errors. Common errors:

- **"Invalid share link"**: The token in the URL doesn't match any share link in the database
- **"Campaign not found"**: The RLS policies haven't been applied (see solution above)
- **Network errors**: Check if your Supabase URL and keys are correct in your `.env` file

### 3. Charts Not Showing

**Cause**: The `post_metrics` table RLS policy hasn't been applied.

**Solution**: Make sure you ran the `database/add_share_link_public_access.sql` script, which includes the policy for `post_metrics`.

### 4. Browser Compatibility Issues

The share links now use an unauthenticated Supabase client that works across all browsers. If you're still experiencing issues:

1. Clear your browser cache
2. Try in an incognito/private window
3. Check the browser console for specific error messages

### 5. Password-Protected Links Not Working

If you set a password on a share link:
- Make sure you're entering the password correctly
- Check the browser console for password validation errors
- The password is hashed using SHA-256 (not bcrypt, for client-side compatibility)

## Verification Steps

1. **Verify share link exists**:
   ```sql
   SELECT * FROM campaign_share_links WHERE share_token = 'YOUR_TOKEN';
   ```

2. **Verify RLS policies are applied**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename IN ('campaigns', 'posts', 'creators', 'post_metrics', 'campaign_share_links')
   AND policyname LIKE '%share link%';
   ```

3. **Test public access**:
   - Open the share link in an incognito/private window
   - Or open it in a different browser where you're not logged in
   - The link should work without requiring authentication

## Still Not Working?

1. Check the browser console for detailed error messages
2. Verify your Supabase environment variables are set correctly
3. Make sure the `campaign_share_links` table exists (run `database/add_campaign_share_links_table.sql` if needed)
4. Verify the share link hasn't expired (check `expires_at` column)

