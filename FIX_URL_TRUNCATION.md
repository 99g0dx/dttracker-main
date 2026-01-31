# Fix URL Truncation Issue

## The Problem

TikTok sound URLs were being truncated, causing API calls to fail. For example:
- **Input:** `https://www.tiktok.com/music/Everyday-7595744832015730704`
- **What was sent:** `https://www.tiktok.com/music/Everyday-759574483201...` (truncated)

## What I Fixed

### 1. Frontend (`src/lib/api/sound-tracks.ts`)
- ✅ **Removed URL truncation** from the actual API call
- ✅ **Kept truncation only in console.log** for readability
- ✅ **Added full URL logging** for debugging
- ✅ **Added error context logging** to see actual error messages

### 2. Edge Function (`supabase/functions/soundtrack_create_from_link/index.ts`)
- ✅ **Created `fullUrl` variable** that preserves the complete URL
- ✅ **Replaced all `url.trim()` references** with `fullUrl`
- ✅ **Added safe JSON parsing** for Apify responses (they might return HTML/plain text)
- ✅ **Enhanced error logging** with full stack traces
- ✅ **Added response body preview** in logs (first 500 chars)

### 3. Sound Tracking Function (`supabase/functions/sound-tracking/index.ts`)
- ✅ **Added safe Apify response handling** - checks if response is JSON before parsing
- ✅ **Logs response preview** before parsing
- ✅ **Better error messages** that include actual response body

## Key Changes

### Before:
```typescript
url: url.substring(0, 50), // ❌ Truncated!
```

### After:
```typescript
const fullUrl = url.trim(); // ✅ Full URL preserved
url: fullUrl, // ✅ Never truncated
```

## Testing

1. **Check console logs** - You should see:
   ```
   [createFromLink] Starting with: { urlLength: 58, urlPreview: "https://www.tiktok.com/music/Everyday-759574483201...", fullUrl: "https://www.tiktok.com/music/Everyday-7595744832015730704" }
   ```

2. **Check Edge Function logs** - You should see:
   ```
   [soundtrack_create_from_link] Received request: { urlLength: 58, fullUrl: "https://www.tiktok.com/music/Everyday-7595744832015730704" }
   ```

3. **Verify the URL is complete** - The full URL should be sent to Apify and sound-tracking

## Error Handling Improvements

Now when errors occur, you'll see:
- ✅ **Full error messages** (not just "non-2xx")
- ✅ **Response body previews** (first 500 chars)
- ✅ **Stack traces** for debugging
- ✅ **Error context** from Supabase JS client

## Next Steps

1. **Deploy the updated function:**
   ```bash
   supabase functions deploy soundtrack_create_from_link
   ```

2. **Test with a full TikTok URL:**
   - Go to `/sounds/new`
   - Paste: `https://www.tiktok.com/music/Everyday-7595744832015730704`
   - Check logs to verify full URL is being sent

3. **If you still get 500 errors:**
   - Check Edge Function logs for the actual error message
   - Look for "Apify status" and "Apify body" logs
   - Share the error message from the logs

The URL should no longer be truncated! 🎉
