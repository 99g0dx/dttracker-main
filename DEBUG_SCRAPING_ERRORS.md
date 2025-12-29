# Debugging Scraping Errors

## Current Issue
You're seeing "[object Object]" in error messages, which means the error object isn't being properly converted to a string.

## What I Fixed

1. **Improved error message extraction** - Now safely extracts error messages from various error formats
2. **Added platform normalization** - Handles "x" -> "twitter" mapping
3. **Enhanced logging** - Better console logs to see what's happening

## Next Steps to Debug

### 1. Check Browser Console
Open DevTools (F12) → Console tab, and look for:
- `Scraping post X/Y:` logs showing which post is being scraped
- `Failed to scrape post:` logs with the actual error
- `Response received:` showing the HTTP status
- `Response text:` showing what the Edge Function returned

### 2. Check Edge Function Logs
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **scrape-post** → **Logs**
3. Look for:
   - `=== Scrape Request Received ===`
   - `Platform mapping:` (shows how platform is being normalized)
   - `Scraping failed:` (shows the actual error)
   - API error messages

### 3. Common Issues

#### Issue 1: Platform Mismatch
- **Symptom**: "Unsupported platform: x" or similar
- **Fix**: The function now normalizes "x" to "twitter"

#### Issue 2: API Key Not Set
- **Symptom**: "RAPIDAPI_KEY not configured" or 403 errors
- **Fix**: Make sure you set the secret:
  ```bash
  supabase secrets set RAPIDAPI_KEY=your-key
  ```

#### Issue 3: Instagram API Issues
- **Symptom**: Instagram posts failing
- **Check**: Make sure you're subscribed to the Instagram Scraper API on RapidAPI

#### Issue 4: Invalid URLs
- **Symptom**: "Invalid post URL format"
- **Fix**: Make sure post URLs are complete (include https://)

## What to Share

If errors persist, share:
1. **Browser console logs** (especially the error messages)
2. **Edge Function logs** (from Supabase dashboard)
3. **Which platforms are failing** (TikTok, Instagram, X/Twitter, etc.)

## Testing

After the fixes:
1. **Restart your dev server**: `npm run dev`
2. **Try scraping again**
3. **Check the console** - you should see detailed logs
4. **Check Edge Function logs** - should show what's happening server-side

The error messages should now be readable instead of "[object Object]".

