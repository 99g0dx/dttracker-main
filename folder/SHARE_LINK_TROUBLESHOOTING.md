# Share Link Not Loading - Troubleshooting Guide

If your share link (`http://localhost:5173/share/campaign/TOKEN`) isn't loading, follow these steps:

## Step 1: Check Browser Console

1. Open the share link in your browser
2. Press `F12` (or `Cmd+Option+I` on Mac) to open Developer Tools
3. Go to the **Console** tab
4. Look for any red error messages

**Common errors:**
- `Failed to fetch` → Edge Function not deployed or network issue
- `Share link not found or expired` → Token doesn't exist or sharing is disabled
- `Supabase URL not configured` → Missing `.env` file

## Step 2: Check Network Tab

1. Open Developer Tools → **Network** tab
2. Reload the page
3. Look for a request to `/functions/v1/share-campaign?token=...`
4. Click on it to see:
   - **Status Code**: Should be 200 (success), 404 (not found), or 401 (password required)
   - **Response**: Check the response body for error messages

## Step 3: Verify Edge Function is Deployed

1. Go to Supabase Dashboard → **Edge Functions**
2. Check if `share-campaign` function exists
3. Click on it and verify the code matches `supabase/functions/share-campaign/index.ts`
4. Check the **Logs** tab for any errors

## Step 4: Check Database

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query to check if the share token exists:
   ```sql
   SELECT id, name, share_enabled, share_token, share_expires_at 
   FROM campaigns 
   WHERE share_token = 'YOUR_TOKEN_HERE';
   ```
3. Verify:
   - `share_enabled` is `true`
   - `share_token` matches your URL token
   - `share_expires_at` is `NULL` or in the future

## Step 5: Check Environment Variables

1. Verify `.env` file exists in project root
2. Check it contains:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. **Restart your dev server** after changing `.env`:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

## Step 6: Verify Edge Function Environment Variables

1. Go to Supabase Dashboard → **Edge Functions** → `share-campaign`
2. Go to **Settings** → **Secrets**
3. Verify these are set:
   - `SUPABASE_URL` (should match your project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (get from Settings → API → service_role key)

## Common Issues & Solutions

### Issue: "Failed to fetch" in console
**Solution**: 
- Edge Function not deployed → Deploy it in Supabase Dashboard
- Check Edge Function logs for errors
- Verify environment variables are set in Edge Function settings

### Issue: "Share link not found or expired"
**Solution**:
- Campaign sharing might be disabled
- Token might not match database
- Link might have expired (check `share_expires_at`)

### Issue: Blank/white page
**Solution**:
- Check browser console for JavaScript errors
- Verify React Router route is configured correctly
- Check if component is crashing (look for errors in console)

### Issue: Stuck on "Loading campaign..."
**Solution**:
- API call is hanging
- Check Network tab to see if request is pending
- Check Edge Function logs
- Verify CORS is configured correctly

## Quick Test

Try accessing the Edge Function directly in your browser:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/share-campaign?token=YOUR_TOKEN
```

If this returns JSON data, the Edge Function is working.
If it returns an error, check the Edge Function logs.

## Still Not Working?

1. Check Supabase Edge Function logs (Dashboard → Edge Functions → Logs)
2. Check browser console for specific error messages
3. Verify the token in your database matches the URL
4. Ensure the campaign has `share_enabled = true`



