# Debugging Twitter Metrics Not Showing

## The Problem
Twitter scraping is successful (status shows "Scraped"), but metrics (views, likes, comments, shares) show as "-" in the UI.

## How to Debug

### Step 1: Check Edge Function Logs

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. Click `scrape-post` → `Logs` tab
3. Find a recent Twitter scraping attempt
4. Look for these log entries:
   - `=== TWITTER API RESPONSE ===` - Shows the full API response
   - `=== STATISTICS OBJECT ===` - Shows what statistics are available
   - `=== TWITTER METRICS EXTRACTED ===` - Shows what we extracted

### Step 2: Share the Logs

Please share:
1. **The full API response** (from `=== TWITTER API RESPONSE ===`)
2. **The statistics object** (from `=== STATISTICS OBJECT ===`)
3. **The extracted metrics** (from `=== TWITTER METRICS EXTRACTED ===`)

This will show me:
- What the API actually returns
- Where the metrics are located
- What values we extracted (and if they're 0)

## Common Issues

### Issue 1: Response Structure Different
**Symptom**: Metrics extracted are all 0
**Solution**: The API response format is different. Share the logs and I'll update the extraction code.

### Issue 2: Field Names Different
**Symptom**: Statistics object exists but field names don't match
**Solution**: Check the logs to see the actual field names (e.g., `likeCount` vs `like_count`)

### Issue 3: Nested Structure
**Symptom**: Data is nested deeper than expected
**Solution**: Check the logs to see the actual structure and update extraction paths.

## What I Need

After you check the logs, share:
- The **actual JSON response** from Twitter (the data object)
- The **statistics object** structure
- What **metrics were extracted** (and their values)

The detailed logs will tell us exactly what's happening!

