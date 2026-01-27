# Fix Apify 400 Error

## The Problem

You're getting `Apify API failed: 400` when trying to create a sound track. This means Apify is rejecting the request due to invalid input.

## What I Fixed

1. ✅ **Updated Apify actor** - Changed from `clockworks~tiktok-sound-scraper` to `apidojo~tiktok-music-scraper`
2. ✅ **Fixed input format** - Now uses `startUrls` array with full TikTok music URLs
3. ✅ **Better error messages** - Shows actual Apify error details
4. ✅ **URL validation** - Uses the original URL or constructs it properly

## Common Causes of 400 Error

1. **Invalid URL format** - Apify needs the full TikTok music page URL
2. **Wrong actor ID** - Must be `apidojo~tiktok-music-scraper` (with `~` not `/`)
3. **Missing/invalid token** - `APIFY_API_TOKEN` must be set correctly
4. **Invalid music ID** - The extracted music ID might be wrong

## Next Steps

1. **Deploy the updated function:**
   ```bash
   supabase functions deploy sound-tracking
   ```

2. **Check Edge Function logs** - Look for:
   - `Calling Apify with` - Shows the canonicalKey being used
   - `Using music URL for Apify` - Shows the URL being sent
   - `Apify error details` - Shows the actual error from Apify

3. **Verify Apify token:**
   ```bash
   supabase secrets list
   ```
   Should show `APIFY_API_TOKEN`

4. **Test again** - The error message should now be more helpful

## If Still Getting 400

Check the Edge Function logs for:
- What `canonicalKey` was extracted
- What `musicUrl` is being sent to Apify
- The actual Apify error message

The logs will show exactly what's being sent to Apify, which will help debug the 400 error.
