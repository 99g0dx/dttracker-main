# Step-by-Step Scraper Debugging

The function is running (you see "Listening on http://localhost:9999/") but not receiving requests. Let's find out why.

## Step 1: Check Browser Console

1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Clear the console** (click the clear icon or press Ctrl+L)
4. **Try scraping a post** (click the refresh icon on a post)
5. **Look for these logs:**
   - `=== Starting scrape request ===`
   - `Request: { postId, postUrl, platform }`
   - `Session found, user: [id]`
   - `Function URL: [url]`
   - `Sending fetch request...`
   - `Response received: { status, ... }`

**What to report:**
- Do you see "=== Starting scrape request ==="? (If NO, the button click isn't working)
- What's the Function URL? (Should be `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/scrape-post`)
- What's the response status? (200, 401, 404, 500, etc.)

## Step 2: Check Network Tab

1. **Open Developer Tools** (F12)
2. **Go to Network tab**
3. **Clear the network log**
4. **Try scraping a post**
5. **Look for a request to `scrape-post`**

**What to check:**
- Is there a request to `/functions/v1/scrape-post`?
- What's the status code? (Red = error, Gray = cancelled, Green = success)
- Click on the request → **Headers tab**:
  - Check **Request URL** (should be your Supabase URL + `/functions/v1/scrape-post`)
  - Check **Request Method** (should be POST)
  - Check **Request Headers** (should have Authorization and Content-Type)
- Click on **Response tab**:
  - What does it say? (Error message, JSON response, etc.)

## Step 3: Verify Environment Variables

1. **Check your `.env` file** in the project root:
   ```env
   VITE_SUPABASE_URL=https://ucbueapoexnxhttynfzy.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. **Restart your dev server** after checking:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

## Step 4: Test the Function URL Directly

Open your browser and try to access:
```
https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/scrape-post
```

**Expected:** You should get a CORS error or method not allowed (this is normal - it means the function exists)

**If you get 404:** The function isn't deployed or the URL is wrong

## Step 5: Check Edge Function Deployment

1. **Go to Supabase Dashboard**
2. **Edge Functions** → **Functions**
3. **Verify `scrape-post` is listed**
4. **Click on it** → Check:
   - Is it deployed? (Should show deployment status)
   - When was it last deployed?
   - Is there any error message?

## Common Issues

### Issue: No logs in browser console
**Cause:** The scrape button isn't triggering the function
**Solution:** Check if the button click handler is working

### Issue: "Function URL: undefined"
**Cause:** `VITE_SUPABASE_URL` not set in `.env`
**Solution:** Add it to `.env` and restart dev server

### Issue: Network request shows "Failed to fetch" or "CORS error"
**Cause:** Function not reachable or CORS misconfigured
**Solution:** Check function is deployed and CORS headers are set

### Issue: 404 Not Found
**Cause:** Function not deployed or wrong URL
**Solution:** Redeploy the function

### Issue: 401 Unauthorized
**Cause:** Auth token invalid or secrets not set
**Solution:** Log out and back in, check secrets are set

## What I Need From You

Please share:
1. **Browser Console output** (copy/paste all logs when you try to scrape)
2. **Network tab screenshot** (or describe what you see for the scrape-post request)
3. **Edge Function status** (is it deployed? any errors?)
4. **Your `.env` file** (just confirm VITE_SUPABASE_URL is set - don't share the key!)

This will help me identify exactly where it's failing.

