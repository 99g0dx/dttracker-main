# Debug Scraping Issues

Follow these steps to diagnose why scraping isn't working.

## Step 1: Check Browser Console

1. Open your browser Developer Tools (F12 or Right-click → Inspect)
2. Go to the **Console** tab
3. Try scraping a post
4. Look for error messages - they will show:
   - The exact URL being called
   - The error type (CORS, 404, 500, etc.)
   - Any network errors

**What to look for:**
- `404 Not Found` = Function not deployed or wrong name
- `CORS error` = CORS configuration issue
- `401 Unauthorized` = Authentication problem
- `500 Internal Server Error` = Function code error
- `Failed to fetch` = Network/connectivity issue

## Step 2: Verify Edge Function is Deployed

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Check if `scrape-post` appears in the functions list
4. Click on it to see:
   - Deployment status
   - Last deployed time
   - Function code

**If function is missing:**
- Redeploy it (see DEPLOY_EDGE_FUNCTION.md)

## Step 3: Check Edge Function Logs

1. In Supabase Dashboard → **Edge Functions** → **Logs**
2. Select `scrape-post` function
3. Try scraping a post
4. Check the logs for:
   - Request received
   - Any error messages
   - Stack traces

**Common log errors:**
- `Missing required fields` = Request body issue
- `Unauthorized` = Auth token problem
- `RAPIDAPI_KEY not configured` = Missing secrets
- `Failed to scrape` = API error

## Step 4: Verify Function URL

The function should be called at:
```
https://YOUR_PROJECT.supabase.co/functions/v1/scrape-post
```

**To check:**
1. Open browser console (F12)
2. Look for the fetch request when scraping
3. Verify the URL matches your project URL

**Common issues:**
- Wrong project URL in `.env` file
- Missing `/functions/v1/` in path
- Wrong function name

## Step 5: Test Function Directly

You can test the function directly using curl or Postman:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/scrape-post \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "test-id",
    "postUrl": "https://www.tiktok.com/@user/video/123",
    "platform": "tiktok"
  }'
```

Replace:
- `YOUR_PROJECT` with your Supabase project ref
- `YOUR_ACCESS_TOKEN` with a valid session token

## Step 6: Check Environment Variables

Verify your `.env` file has:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Important:**
- Restart dev server after changing `.env`
- No spaces around `=`
- No quotes needed around values

## Step 7: Verify Secrets are Set

1. Go to **Edge Functions** → **Settings** → **Secrets**
2. Check these secrets exist:
   - `SUPABASE_URL` (your project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (service role key)
   - `RAPIDAPI_KEY` (optional, for real data)
   - `YOUTUBE_API_KEY` (optional, for YouTube)

**Note:** Without `RAPIDAPI_KEY` and `YOUTUBE_API_KEY`, the function will return mock data, but it should still work.

## Step 8: Check Authentication

1. Make sure you're logged in
2. Check browser console for auth errors
3. Try logging out and back in
4. Verify session is valid

## Common Issues & Solutions

### Issue: "404 Not Found"
**Solution:** Function not deployed. Deploy it again.

### Issue: "CORS error"
**Solution:** 
- Check function has CORS headers (it should)
- Verify you're calling from the correct origin
- Check browser console for specific CORS error

### Issue: "401 Unauthorized"
**Solution:**
- Check you're logged in
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in secrets
- Try logging out and back in

### Issue: "Failed to fetch"
**Solution:**
- Check internet connection
- Verify function is deployed
- Check function URL is correct
- Look for CORS errors in console

### Issue: Function works but returns errors
**Solution:**
- Check Edge Function logs for specific errors
- Verify API keys are set (if using real APIs)
- Check post URLs are valid

## Get Help

If still not working, provide:
1. **Browser console error** (screenshot or copy text)
2. **Edge Function logs** (from Supabase dashboard)
3. **Function deployment status** (is it deployed?)
4. **Error message from toast notification**

This will help diagnose the exact issue.

