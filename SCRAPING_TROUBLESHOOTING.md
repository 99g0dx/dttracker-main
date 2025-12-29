# Scraping Troubleshooting Guide

If scraping keeps failing, follow these steps to diagnose and fix the issue.

## Common Issues and Solutions

### 1. Database Schema Issue (Most Common)

**Symptom:** All scraping attempts fail immediately with a database constraint error.

**Solution:** Run the database migration to add the 'scraping' status:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration script: `database/fix_scraping_status.sql`

This adds 'scraping' as a valid status value for posts.

### 2. Missing API Keys

**Symptom:** Scraping returns mock data or fails with "API error" messages.

**Solution:** Configure API keys in Supabase Edge Function secrets:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Settings** → **Secrets**
3. Add the following secrets:

   - `RAPIDAPI_KEY` - For TikTok and Instagram scraping
     - Get it from: https://rapidapi.com/
     - Subscribe to: "TikTok Video No Watermark" and "Instagram Scraper API2"
   
   - `YOUTUBE_API_KEY` - For YouTube scraping (optional)
     - Get it from: https://console.cloud.google.com/apis/credentials
     - See `GET_YOUTUBE_API_KEY.md` for detailed instructions

**Note:** If API keys are missing, the scraper will return mock data for development.

### 3. Invalid Post URLs

**Symptom:** Scraping fails with "Invalid post URL" or "Video not found" errors.

**Solution:** 
- Ensure post URLs are complete and valid
- For YouTube: URLs must be in format `https://youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`
- For TikTok: URLs must be complete TikTok video URLs
- For Instagram: URLs must be complete Instagram post URLs

### 4. Network/API Rate Limits

**Symptom:** Some posts scrape successfully, others fail intermittently.

**Solution:**
- The scraper automatically waits 2 seconds between requests
- If you hit API rate limits, wait a few minutes and try again
- Check your RapidAPI subscription limits
- For YouTube: Free tier allows 10,000 requests/day

### 5. Authentication Issues

**Symptom:** Scraping fails with "Unauthorized" errors.

**Solution:**
- Make sure you're logged in
- Try logging out and logging back in
- Check that your Supabase session is valid

## Checking Error Details

### In the Browser Console

1. Open browser Developer Tools (F12)
2. Go to the **Console** tab
3. Look for error messages when scraping fails
4. Error messages will show:
   - The specific platform that failed
   - The error reason (API error, invalid URL, etc.)
   - The post URL that failed

### In Supabase Logs

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Logs**
3. Select the `scrape-post` function
4. Look for error messages in the logs

## Testing Scraping

### Test a Single Post

1. Go to a campaign with posts
2. Find a post with a valid URL
3. The post should automatically scrape when added
4. Or use the "Scrape All Posts" button

### Verify API Keys Are Set

The scraper will return mock data if API keys are missing. To verify:

1. Check Supabase Edge Function secrets
2. Look for `RAPIDAPI_KEY` and `YOUTUBE_API_KEY`
3. If missing, add them (see section 2 above)

## Platform-Specific Notes

### TikTok
- Requires RapidAPI subscription
- Works with standard TikTok video URLs
- Returns: views, likes, comments, shares

### Instagram
- Requires RapidAPI subscription  
- Works with Instagram post URLs
- Returns: views (for videos), likes, comments
- Note: Share count is not available via API

### YouTube
- Requires YouTube Data API v3 key (free tier available)
- Works with `youtube.com/watch?v=` or `youtu.be/` URLs
- Returns: views, likes, comments
- Note: Share count is not available via API

### Twitter
- Currently returns mock data
- Full implementation coming soon

### Facebook
- Currently returns mock data
- Full implementation coming soon

## Still Having Issues?

If scraping still fails after trying the above:

1. **Check the specific error message** in the toast notification
2. **Check browser console** for detailed error logs
3. **Check Supabase Edge Function logs** for server-side errors
4. **Verify your post URLs** are correct and accessible
5. **Test with a single post** first before scraping all

## Error Message Reference

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Missing required fields" | Invalid request | Check post data |
| "Invalid post URL format" | Malformed URL | Fix the post URL |
| "API error (401)" | Invalid API key | Check API key configuration |
| "API error (429)" | Rate limit exceeded | Wait and try again |
| "Video not found" | Invalid or private video | Check URL and video visibility |
| "Unauthorized" | Auth session expired | Log out and log back in |
| "Database constraint" | Missing 'scraping' status | Run migration script |

