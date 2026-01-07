# Step-by-Step Guide: Fix Runtime Errors in Scrapers

This guide provides step-by-step instructions to fix runtime errors when running TikTok and Instagram scrapers.

## ✅ Already Completed

The following fixes have been implemented in the code:

1. **Backward compatibility for `last_scraped_at` column**: The code now gracefully handles cases where this column doesn't exist in the database
2. **Enhanced TikTok URL extraction**: Multiple URL pattern matching to handle various TikTok URL formats
3. **Time-based re-scraping prevention**: Instagram posts won't be re-scraped within 1 hour

## Step-by-Step Instructions

### Step 1: Verify Database Schema

**Action**: Check if `last_scraped_at` column exists in your database

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'posts' AND column_name = 'last_scraped_at';
   ```

**If the column doesn't exist:**
- Run the migration SQL file: `database/add_last_scraped_at_column.sql`
- Or run this SQL in Supabase SQL Editor:
  ```sql
  ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;
  ```

**Note**: The code will work without this column (it falls back to `updated_at`), but having it provides more accurate re-scraping prevention.

### Step 2: Deploy Updated Edge Functions

**Action**: Deploy the updated edge functions to Supabase

**Option A: Using Supabase CLI** (Recommended)
```bash
# Navigate to your project root
cd /path/to/your/project

# Deploy scrape-post function
supabase functions deploy scrape-post

# Deploy scrape-all-posts function
supabase functions deploy scrape-all-posts
```

**Option B: Using Supabase Dashboard**
1. Go to Supabase Dashboard → Edge Functions
2. For each function (`scrape-post` and `scrape-all-posts`):
   - Click on the function
   - Click "Edit" or "Update"
   - Copy the contents from `supabase/functions/[function-name]/index.ts`
   - Paste and save

### Step 3: Verify Environment Variables/Secrets

**Action**: Ensure all required secrets are configured

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Verify these secrets exist:
   - `RAPIDAPI_KEY` - Your RapidAPI key for TikTok/Instagram scraping
   - `SUPABASE_URL` - Your Supabase project URL (usually auto-configured)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (usually auto-configured)
   - `SUPABASE_ANON_KEY` - Your anon key (usually auto-configured)

**If any are missing:**
1. Click "Add new secret"
2. Enter the secret name (e.g., `RAPIDAPI_KEY`)
3. Enter the secret value
4. Click "Save"

**To set via CLI:**
```bash
supabase secrets set RAPIDAPI_KEY=your_rapidapi_key_here
```

### Step 4: Check Edge Function Logs

**Action**: Review logs to identify specific errors

1. Go to Supabase Dashboard → Edge Functions → Logs
2. Filter by function name (`scrape-post` or `scrape-all-posts`)
3. Look for error messages, especially:
   - "column last_scraped_at does not exist"
   - "Could not extract video ID (aweme_id) from TikTok URL"
   - "Failed to extract metrics from TikTok API response"
   - API authentication errors

4. For TikTok URL extraction issues, look for:
   - "Matched Pattern X" messages (shows which pattern worked)
   - "TIKTOK URL EXTRACTION FAILED" sections with the actual URL format

### Step 5: Test Individual Scrapers

**Action**: Test each scraper individually to isolate issues

**Test TikTok Scraper:**
1. In your app, try scraping a single TikTok post
2. Check the edge function logs immediately after
3. Look for:
   - Successful video ID extraction (should see "Matched Pattern X")
   - API response status
   - Any error messages

**Test Instagram Scraper:**
1. In your app, try scraping a single Instagram post
2. Check the edge function logs immediately after
3. Verify it's not being re-scraped if it was scraped recently (< 1 hour ago)

**Test Bulk Scraping:**
1. Use "Scrape All" functionality
2. Verify:
   - Posts scraped within last hour are skipped
   - Only pending/failed posts are scraped
   - Stuck "scraping" posts (>5 minutes) are re-attempted

### Step 6: Common Issues and Solutions

**Issue: "column last_scraped_at does not exist"**

**Solution**: 
- The code now handles this gracefully by falling back to `updated_at`
- However, for best results, add the column using `database/add_last_scraped_at_column.sql`

**Issue: "Could not extract video ID (aweme_id) from TikTok URL"**

**Solution**:
1. Check the logs for the exact URL format that failed
2. The enhanced code now supports 7 different URL patterns
3. If your URL format still doesn't match, check logs for "TIKTOK URL EXTRACTION FAILED" section
4. Share the URL format with the development team to add support

**Issue: "Failed to extract metrics from TikTok API response"**

**Solution**:
1. This usually means the API response structure changed
2. Check logs for "TIKTOK API RESPONSE" sections
3. The actual response structure will be logged
4. The code validates that at least some metrics were extracted (not all zeros)

**Issue: Instagram posts being re-scraped too frequently**

**Solution**:
- This is now fixed! The code prevents re-scraping posts that were scraped within the last hour
- Check logs to verify the filter is working (should see fewer posts being scraped)

**Issue: Authentication errors (401, 403)**

**Solution**:
1. Verify `RAPIDAPI_KEY` is set correctly in Edge Function secrets
2. Check if your RapidAPI subscription is active
3. Verify the API endpoint URLs in the code match your RapidAPI subscription

### Step 7: Verify Everything Works

After completing the above steps:

1. ✅ Database has `last_scraped_at` column (or code handles missing column)
2. ✅ Edge functions are deployed with latest code
3. ✅ All required secrets are configured
4. ✅ Logs show successful scraping (no errors)
5. ✅ TikTok URLs are extracting video IDs correctly
6. ✅ Instagram posts aren't being re-scraped unnecessarily

## Troubleshooting Tips

- **Check logs first**: Most issues will show up in edge function logs with detailed error messages
- **Test one platform at a time**: Isolate issues by testing TikTok and Instagram separately
- **Use single post scraping first**: Before testing bulk scraping, verify single post scraping works
- **Check API quotas**: Ensure you haven't exceeded your RapidAPI quota

## Need More Help?

If you encounter errors not covered here:
1. Copy the exact error message from the logs
2. Note which platform (TikTok/Instagram) and operation (single/bulk)
3. Include the URL format if it's a URL extraction issue
4. Share with the development team for assistance

