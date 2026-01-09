# Fix Instagram and TikTok Scraping Issues

## Current Status
- ✅ **X/Twitter**: Working (but returning mock data - not real API)
- ❌ **Instagram**: Failing
- ❌ **TikTok**: Failing

## Step 1: Check Edge Function Logs

The most important step is to see what errors are actually happening:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. **Click `scrape-post` → `Logs` tab**
3. **Try scraping an Instagram post**
4. **Look for these log entries**:
   - `=== Instagram Scraping ===`
   - `RapidAPI Key present: true/false`
   - `Instagram API Response Status: [number]`
   - `Full error response: [message]`

5. **Try scraping a TikTok post**
6. **Look for**:
   - `=== TikTok Scraping ===`
   - `TikTok API Response Status: [number]`
   - `Full error response: [message]`

## Step 2: Verify RapidAPI Subscriptions

You need to be subscribed to the **exact APIs** used in the code:

### For TikTok:
1. Go to https://rapidapi.com/hub
2. Search for: **"TikTok Video No Watermark"** or **"tiktok-video-no-watermark2"**
3. Make sure you're subscribed to this specific API
4. Check the API name matches: `tiktok-video-no-watermark2.p.rapidapi.com`

### For Instagram:
1. Search for: **"Instagram Scraper API2"** or **"instagram-scraper-api2"**
2. Make sure you're subscribed to this specific API
3. Check the API name matches: `instagram-scraper-api2.p.rapidapi.com`

**Important**: Different APIs on RapidAPI have different names. You must subscribe to the **exact API** that matches the hostname in the code.

## Step 3: Common Error Codes and Solutions

### Error 403: "You are not subscribed to this API"
**Problem**: Your RapidAPI key doesn't have access to this specific API
**Solution**: 
1. Go to RapidAPI Hub
2. Find the exact API (see Step 2)
3. Click "Subscribe" and choose a plan
4. Make sure the API hostname matches what's in the code

### Error 429: "Too Many Requests"
**Problem**: Rate limit exceeded
**Solution**: 
- Wait a few minutes
- Upgrade your RapidAPI plan for higher limits
- Check your usage in RapidAPI dashboard

### Error 400: "Bad Request"
**Problem**: Invalid URL format or missing parameters
**Solution**: 
- Check the post URL format in the logs
- Make sure URLs are complete (include https://)
- Verify the API endpoint format hasn't changed

### Error 500: "Internal Server Error"
**Problem**: API service issue or response format changed
**Solution**: 
- Check RapidAPI status page
- The API response format might have changed - check logs for response data

## Step 4: Test APIs Directly

You can test if the APIs work outside of the Edge Function:

### Test TikTok API:
```bash
curl -X POST "https://tiktok-video-no-watermark2.p.rapidapi.com/" \
  -H "content-type: application/x-www-form-urlencoded" \
  -H "X-RapidAPI-Key: e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454" \
  -H "X-RapidAPI-Host: tiktok-video-no-watermark2.p.rapidapi.com" \
  -d "url=https://www.tiktok.com/@username/video/1234567890&hd=1"
```

Replace the URL with an actual TikTok video URL.

### Test Instagram API:
```bash
curl -X GET "https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=https://www.instagram.com/p/ABC123/" \
  -H "X-RapidAPI-Key: e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454" \
  -H "X-RapidAPI-Host: instagram-scraper-api2.p.rapidapi.com"
```

Replace the URL with an actual Instagram post URL.

**If these curl commands fail**, the issue is with your RapidAPI subscription, not the code.

## Step 5: Check API Response Format

If the APIs return 200 OK but the scraping still fails, the response format might have changed. Check the logs for:
- `Instagram API Response Data: [data]`
- `TikTok API Response Data: [data]`

Compare the structure with what the code expects. The code looks for:
- **TikTok**: `data.data.play_count`, `data.data.digg_count`, etc.
- **Instagram**: `data.data.like_count`, `data.data.comment_count`, etc.

## Step 6: Alternative APIs

If the current APIs don't work, you might need to:

1. **Find alternative RapidAPI services**:
   - Search RapidAPI Hub for other TikTok/Instagram scrapers
   - Update the code with new API endpoints
   - Update the hostnames and request formats

2. **Use official APIs** (if available):
   - Instagram Basic Display API (requires app approval)
   - TikTok API (limited access)

## Step 7: Share the Logs

After checking the logs, share:
1. **The exact error messages** from Edge Function logs
2. **The API response status codes** (403, 429, 400, etc.)
3. **The full error response text** from RapidAPI
4. **Whether you're subscribed to the exact APIs** mentioned above

## About X/Twitter

X/Twitter is currently returning **mock data** (random numbers), not real metrics. This is why it "works" but shows incorrect data. To fix this, we'd need to:
1. Find a working Twitter/X API on RapidAPI
2. Implement the real scraping function
3. Update the code

## Next Steps

1. **Check Edge Function logs** (most important)
2. **Verify RapidAPI subscriptions** match the exact API names
3. **Test APIs directly** with curl commands
4. **Share the specific error messages** you see in the logs

The detailed logs I added will show exactly what's happening!

