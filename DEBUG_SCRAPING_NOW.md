# Quick Debugging Guide for Scraping

## The Issue
Your app uses **Supabase Edge Functions** (not a local Express server). The scraping calls:
```
https://your-project.supabase.co/functions/v1/scrape-post
```

## Step 1: Check Browser Console
1. Open your app in the browser
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Click "Scrape" on a post
5. Look for logs starting with `=== Starting scrape request ===`

You should see:
- ✅ `Session found, user: [user-id]`
- ✅ `Function URL: https://...supabase.co/functions/v1/scrape-post`
- ✅ `Sending fetch request...`
- ✅ `Response received: { status: 200, ... }`

## Step 2: Check Network Tab
1. In DevTools, go to the **Network** tab
2. Click "Scrape" again
3. Look for a request to `/functions/v1/scrape-post`
4. Click on it to see:
   - **Request URL**: Should be your Supabase URL + `/functions/v1/scrape-post`
   - **Request Method**: POST
   - **Status Code**: 
     - 200 = Success
     - 401 = Authentication failed
     - 404 = Function not found (not deployed)
     - 500 = Function error

## Step 3: Check Edge Function Logs
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **scrape-post**
3. Click on **Logs**
4. Look for recent invocations when you clicked "Scrape"

You should see:
- `Function invoked` 
- `Request received: { postId: "...", ... }`
- `Scraping metrics...`
- `✅ Success` or error messages

## Common Issues

### Issue 1: Function Not Deployed
**Symptom**: Network tab shows 404
**Fix**: Deploy the Edge Function:
```bash
supabase functions deploy scrape-post
```

### Issue 2: Authentication Failed
**Symptom**: Network tab shows 401
**Fix**: Check that:
- You're logged in to the app
- The Edge Function has the correct CORS headers
- Your session token is valid

### Issue 3: Function Error
**Symptom**: Network tab shows 500, or logs show errors
**Fix**: Check Edge Function logs for:
- Missing environment variables (RAPIDAPI_KEY, YOUTUBE_API_KEY)
- API rate limits
- Invalid post URLs

### Issue 4: CORS Error
**Symptom**: Console shows "CORS policy" error
**Fix**: The Edge Function needs CORS headers. Check `supabase/functions/scrape-post/index.ts` has:
```typescript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

## Next Steps
1. Run through Steps 1-3 above
2. Share what you see in:
   - Browser Console logs
   - Network tab (status code and response)
   - Edge Function logs
3. We'll fix the specific issue based on what you find

