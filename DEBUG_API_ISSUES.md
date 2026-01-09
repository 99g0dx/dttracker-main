# Debugging API Issues - Comprehensive Guide

## The Problem
You've paid for RapidAPI subscriptions but the APIs aren't working. Let's diagnose exactly what's happening.

## Step 1: Deploy Updated Function with Detailed Logging

I've added comprehensive logging to both TikTok and Instagram scraping functions. Deploy it:

```bash
supabase functions deploy scrape-post
```

## Step 2: Check Edge Function Logs

After deploying, check the logs to see exactly what's happening:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. **Click `scrape-post` → `Logs` tab**
3. **Try scraping a post**
4. **Look for these log entries**:

### For TikTok:
- `=== TikTok Scraping ===`
- `RapidAPI Key present: true/false`
- `RapidAPI Key length: [number]`
- `TikTok API Response Status: [status]`
- `TikTok API Response Data: [data]`

### For Instagram:
- `=== Instagram Scraping ===`
- `RapidAPI Key present: true/false`
- `RapidAPI Key length: [number]`
- `Instagram API Response Status: [status]`
- `Instagram API Response Data: [data]`

## Step 3: Common Issues and Solutions

### Issue 1: "RapidAPI Key present: false"
**Problem**: The secret isn't set or isn't accessible
**Solution**:
```bash
supabase secrets set RAPIDAPI_KEY=e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454
supabase functions deploy scrape-post
```

### Issue 2: "403 Forbidden" or "You are not subscribed to this API"
**Problem**: Your RapidAPI key doesn't have access to the specific API
**Solution**:
1. Go to https://rapidapi.com/hub
2. Check your subscriptions:
   - **TikTok**: "TikTok Video No Watermark" API
   - **Instagram**: "Instagram Scraper API2" or "Instagram Scraper API"
3. If not subscribed, click "Subscribe" and choose a plan
4. Make sure you're subscribed to the **exact API names** used in the code

### Issue 3: "429 Too Many Requests"
**Problem**: Rate limit exceeded
**Solution**: Wait a few minutes and try again, or upgrade your RapidAPI plan

### Issue 4: "400 Bad Request" or "Invalid URL"
**Problem**: The post URL format is wrong
**Solution**: Check the post URL format in the logs

### Issue 5: API Response format changed
**Problem**: The API response structure doesn't match what we expect
**Solution**: Check the "API Response Data" in logs - we'll need to update the data extraction code

## Step 4: Verify Your RapidAPI Subscriptions

1. **Go to RapidAPI Dashboard**: https://rapidapi.com/developer/billing
2. **Check Active Subscriptions**:
   - Look for "TikTok Video No Watermark"
   - Look for "Instagram Scraper API2" or similar
3. **Check API Usage**:
   - See if you've hit rate limits
   - Check if subscriptions are active

## Step 5: Test APIs Directly

You can test the APIs directly to see if they work:

### Test TikTok API:
```bash
curl -X POST "https://tiktok-video-no-watermark2.p.rapidapi.com/" \
  -H "content-type: application/x-www-form-urlencoded" \
  -H "X-RapidAPI-Key: e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454" \
  -H "X-RapidAPI-Host: tiktok-video-no-watermark2.p.rapidapi.com" \
  -d "url=YOUR_TIKTOK_URL&hd=1"
```

### Test Instagram API:
```bash
curl -X GET "https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=YOUR_INSTAGRAM_URL" \
  -H "X-RapidAPI-Key: e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454" \
  -H "X-RapidAPI-Host: instagram-scraper-api2.p.rapidapi.com"
```

Replace `YOUR_TIKTOK_URL` and `YOUR_INSTAGRAM_URL` with actual post URLs.

## Step 6: Share the Logs

After checking the logs, share:
1. **What you see in Edge Function logs** (especially the error messages)
2. **The API response status codes** (403, 429, 400, etc.)
3. **Any error messages from RapidAPI**
4. **Whether your RapidAPI subscriptions are active**

## What the Logs Will Tell Us

The detailed logs will show:
- ✅ If the API key is being sent
- ✅ What status code the API returns
- ✅ The exact error message from RapidAPI
- ✅ What data (if any) the API returns
- ✅ Where exactly the scraping fails

Once we see the logs, we can fix the exact issue!

