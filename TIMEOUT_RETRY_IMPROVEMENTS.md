# Timeout and Retry Logic Improvements

## Overview
Enhanced the timeout and retry logic in `scrape-all-posts` edge function to better handle large batches of posts and provide better visibility into the scraping process.

## Improvements Made

### 1. Predictive Timeout Checking
- **Before**: Checked timeout after completing each post (reactive)
- **After**: Checks timeout before starting each post (predictive)
- **Benefit**: Prevents starting a new scrape if we won't have time to complete it
- **Implementation**: Uses 85% of max time (212.5 seconds) as a "safe limit" plus estimates ~4 seconds per post

### 2. Enhanced Progress Logging
- **Added metrics per post**:
  - Progress percentage (e.g., "45.2%")
  - Elapsed time
  - Average time per post
  - Estimated remaining time
- **Example log output**:
  ```
  [15/50] (30.0%) Scraping post abc123 (tiktok) | Elapsed: 45.2s | Avg: 3.0s/post | Est. remaining: 105s
  ```

### 3. Adaptive Rate Limiting
- **Before**: Fixed 2-second delay (1 second if low on time)
- **After**: Dynamic delay that adjusts based on:
  - Time remaining
  - Number of posts remaining
  - Estimated time needed for remaining posts
- **Delay schedule**:
  - Default: 2 seconds
  - < 60s remaining: 1.5 seconds
  - < 30s remaining: 1 second
  - < 10s remaining: 0.5 seconds
- **Smart adjustment**: Reduces delay if it would prevent finishing remaining posts

### 4. Better Summary Statistics
- **Added to completion log**:
  - Total execution time
  - Average time per post
- **Example output**:
  ```
  === Scrape All Posts Complete ===
  ✅ Success: 45, ❌ Errors: 5, ⏱️ Total time: 142.3s, 📊 Avg: 2.84s/post
  ```

### 5. Improved Timeout Handling
- **More detailed timeout warnings** with:
  - Elapsed time
  - Remaining time
  - Number of posts processed
  - Number of posts remaining
- **Better error messages** that indicate exactly what happened

## How It Works

### Timeout Protection Flow

```
1. Start scraping loop
2. Before each post:
   - Check elapsed time
   - Check if time remaining < estimated time for next post
   - If yes → stop gracefully and reset remaining posts to "pending"
3. Scrape the post
4. Adjust rate limit delay based on time remaining
5. Continue to next post
```

### Adaptive Rate Limiting Logic

```
If time remaining < 10s:   delay = 0.5s  (maximize posts)
If time remaining < 30s:   delay = 1.0s
If time remaining < 60s:   delay = 1.5s
Otherwise:                 delay = 2.0s  (normal rate)

Additionally:
- Calculate estimated time for remaining posts
- If estimated > time remaining, reduce delay further
- Ensures we can finish all remaining posts
```

## Expected Behavior

### Small Batches (< 50 posts)
- Should complete without timeout
- Normal 2-second rate limiting
- All posts scraped in single run

### Medium Batches (50-100 posts)
- May hit timeout protection
- Adaptive rate limiting kicks in
- Remaining posts reset to "pending" for next run
- Detailed logs show progress

### Large Batches (> 100 posts)
- Will definitely hit timeout protection
- Multiple runs needed
- Each run processes as many posts as possible
- Adaptive rate limiting maximizes throughput
- Progress logs help track overall completion

## Monitoring and Debugging

### Key Log Messages to Watch

**Start of scraping**:
```
🚀 Starting to scrape 75 posts (max time: 250s, safe limit: 212.5s)
```

**During scraping**:
```
[15/75] (20.0%) Scraping post abc123 (tiktok) | Elapsed: 45.2s | Avg: 3.0s/post | Est. remaining: 180s
✅ Post abc123 scraped successfully
```

**Timeout warning**:
```
⏱️ Approaching execution time limit. Elapsed: 210.5s, Remaining: 39.5s, Processed: 58/75 posts, Remaining: 17 posts
📋 Reset 17 remaining posts to pending status
```

**Completion**:
```
=== Scrape All Posts Complete ===
✅ Success: 58, ❌ Errors: 0, ⏱️ Total time: 212.3s, 📊 Avg: 3.66s/post
```

### What to Check If Issues Occur

1. **Check logs for timeout messages** - Shows if/when timeout protection activated
2. **Check average time per post** - If consistently high, may indicate API slowness
3. **Check estimated remaining time** - Helps predict if batch will complete
4. **Check rate limit adjustments** - Should see delay reductions as time runs low
5. **Check post statuses** - Remaining posts should be "pending" after timeout

## Benefits

1. **More posts scraped before timeout** - Adaptive rate limiting maximizes throughput
2. **Better predictability** - Timeout checks prevent wasted API calls
3. **Better visibility** - Detailed logs help understand what's happening
4. **Graceful degradation** - Large batches automatically split across multiple runs
5. **No data loss** - Remaining posts are properly reset to "pending" for next run

## Next Steps

After deploying these changes:

1. Monitor the logs during a "Scrape All" operation
2. Verify the timeout protection works correctly
3. Check that remaining posts are properly reset to "pending"
4. Verify subsequent runs pick up the remaining posts
5. Adjust `MAX_EXECUTION_TIME` or `SAFE_EXECUTION_TIME` if needed based on your edge function plan

