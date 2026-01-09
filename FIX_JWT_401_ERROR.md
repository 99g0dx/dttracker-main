# Fix for Persistent "Invalid JWT" Error (401)

## The Problem
You're getting `{"code":401,"message":"Invalid JWT"}` errors even after deploying the updated Edge Function. This error is coming from **Supabase's infrastructure**, not from our code - it happens before the function code even runs.

## Root Cause
Supabase Edge Functions automatically verify JWTs before your function code executes. If the JWT verification fails at the infrastructure level, you get a 401 error before reaching your function.

## Possible Causes

1. **JWT Token Expired** - Even though we check expiration, the token might expire between check and request
2. **JWT Token Format Issue** - The token might not be in the correct format
3. **Project Mismatch** - The JWT might be for a different Supabase project
4. **Token Not Refreshed** - The refresh logic might not be working correctly

## Solution: Check Edge Function Logs

First, let's see what's actually happening:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. **Click on `scrape-post` function**
3. **Go to the "Logs" tab**
4. **Try scraping a post again**
5. **Check the logs** - Do you see:
   - `=== Scrape Request Received ===`? 
   - If YES: The function is running, the issue is in our code
   - If NO: Supabase is rejecting the request before it reaches our code

## If Logs Show Function Never Runs

If you don't see `=== Scrape Request Received ===` in the logs, Supabase is rejecting the JWT before our code runs. Try:

### Option 1: Log Out and Log Back In
The JWT might be corrupted or for a different session:
1. Log out of your app
2. Clear browser storage (DevTools → Application → Local Storage → Clear)
3. Log back in
4. Try scraping again

### Option 2: Check Token in Browser Console
1. Open browser console (F12)
2. Run this command:
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   console.log("Token:", session?.access_token?.substring(0, 50) + "...");
   console.log("Expires at:", new Date(session?.expires_at * 1000));
   console.log("Expires in:", (session?.expires_at - Math.floor(Date.now() / 1000)) / 60, "minutes");
   ```
3. Check if the token looks valid and isn't expired

### Option 3: Verify Project URL Matches
Make sure your `.env` file has the correct Supabase URL:
```env
VITE_SUPABASE_URL=https://ucbueapoexnxhttynfzy.supabase.co
```

The JWT must be issued for this exact project URL.

## If Logs Show Function Runs

If you DO see `=== Scrape Request Received ===` in the logs, then the function is running and the issue is in our authentication code. Check the logs for:
- `Token received, length: [number]` - Should be a long string
- `Authenticated user: [user-id]` - Should show your user ID
- Any error messages after that

## Quick Test

Try this in your browser console after logging in:
```javascript
// Test if we can call the Edge Function directly
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch('https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/scrape-post', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': 'YOUR_ANON_KEY_HERE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    postId: 'test',
    postUrl: 'https://example.com',
    platform: 'tiktok'
  })
});
console.log('Status:', response.status);
console.log('Response:', await response.text());
```

Replace `YOUR_ANON_KEY_HERE` with your actual anon key from `.env`.

## Next Steps

1. **Check Edge Function logs** first (most important)
2. **Share what you see** in the logs
3. **Try logging out and back in**
4. **Check the browser console** for token info

The logs will tell us exactly where the problem is!

