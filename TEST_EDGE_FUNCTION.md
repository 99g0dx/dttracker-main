# Quick Test: Is the Edge Function Reachable?

Let's verify the function is actually deployed and reachable.

## Test 1: Check Function URL in Browser

1. Open a new browser tab
2. Go to: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/scrape-post`
3. You should see either:
   - A CORS error (this is GOOD - means function exists)
   - Method not allowed (this is GOOD - means function exists)
   - 404 Not Found (BAD - function not deployed)

## Test 2: Check Browser Console When Scraping

1. Open Developer Tools (F12)
2. Go to **Console** tab
3. **Clear the console**
4. Click the scrape button on a post
5. **Copy and paste ALL console output here**

You should see logs starting with "=== Starting scrape request ==="

## Test 3: Check Network Tab

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. **Clear the network log**
4. Click the scrape button
5. Look for a request to `scrape-post`
6. **If you see it:**
   - Click on it
   - Check the **Status** (200, 401, 404, 500, etc.)
   - Check the **Response** tab
7. **If you DON'T see it:**
   - The request isn't being sent
   - Check console for errors

## Most Likely Issues

### 1. Environment Variable Not Set
**Check:** Is `VITE_SUPABASE_URL` in your `.env` file?
**Fix:** Add it and restart dev server

### 2. Function Not Actually Deployed
**Check:** Supabase Dashboard → Edge Functions → Is `scrape-post` listed?
**Fix:** Deploy it again

### 3. Request Not Being Sent
**Check:** Browser console - do you see "=== Starting scrape request ==="?
**Fix:** Check if button click handler is working

### 4. CORS Blocking
**Check:** Network tab - do you see a CORS error?
**Fix:** CORS headers should be in the function (they are)

## What I Need

Please share:
1. **Browser Console output** (all logs when you click scrape)
2. **Network tab** - is there a request? What's the status?
3. **Edge Function logs** - any new logs after you try scraping?

This will tell us exactly what's happening.

