# Debugging TikTok Metrics Not Showing

## The Problem
TikTok scraping is successful (status shows "Scraped"), but metrics (views, likes, comments) show as "-" in the UI.

## Possible Causes

1. **API Response Format Mismatch**: The TikTok Data API might return data in a different structure than we're extracting
2. **Values Are 0**: The extraction might be finding 0 values instead of actual metrics
3. **Data Type Issue**: Values might be strings instead of numbers

## How to Debug

### Step 1: Check Edge Function Logs

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. Click `scrape-post` → `Logs` tab
3. Find a recent TikTok scraping attempt
4. Look for these log entries:
   - `TikTok API Response Data: [data]` - Shows the full API response
   - `TikTok API Response Structure: {...}` - Shows what keys are available
   - `TikTok Metrics Extracted: {...}` - Shows what we extracted

### Step 2: Check the Actual Response

The logs will show:
- What the API actually returns
- What fields are available
- What values we extracted

### Step 3: Share the Logs

Once you check the logs, share:
1. **The full API response** (from `TikTok API Response Data`)
2. **The response structure** (from `TikTok API Response Structure`)
3. **The extracted metrics** (from `TikTok Metrics Extracted`)

## What I've Added

I've added detailed logging that will show:
- The full API response structure
- All available keys in the response
- What metrics were extracted
- Whether values are being converted to numbers properly

## Quick Test

After deploying, try scraping a TikTok post and check:
1. **Edge Function logs** - See what the API actually returns
2. **Browser console** - Check for any errors
3. **Database** - Check if values are being saved (they might be 0)

## Common Issues

### Issue 1: Response Structure Different
**Symptom**: Metrics extracted are all 0
**Solution**: The API response format is different. Share the logs and I'll update the extraction code.

### Issue 2: Values Are Strings
**Symptom**: Values might be strings instead of numbers
**Solution**: I've added `Number()` conversion, but we might need to handle it differently.

### Issue 3: Nested Structure
**Symptom**: Data is nested deeper than expected
**Solution**: Check the logs to see the actual structure and update extraction paths.

## Next Steps

1. **Deploy the updated function** (with better logging)
2. **Try scraping a TikTok post**
3. **Check Edge Function logs**
4. **Share what you see** in the logs

The detailed logs will tell us exactly what's happening!

