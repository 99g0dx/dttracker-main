# Diagnose Why Scraping Isn't Starting

## Quick Checks

### 1. Check if `soundtrack_start_scrape` function is deployed
```bash
supabase functions list
```
Look for `soundtrack_start_scrape` in the list. If missing, deploy it:
```bash
supabase functions deploy soundtrack_start_scrape
```

### 2. Check Edge Function Logs

**For `soundtrack_create_from_link`:**
1. Go to Supabase Dashboard → Edge Functions → `soundtrack_create_from_link` → Logs
2. Look for these log messages:
   - `[soundtrack_create_from_link] Scrape job started:` ✅ Good - scraping was initiated
   - `[soundtrack_create_from_link] Failed to start scrape job` ❌ Problem - check error details
   - `[soundtrack_create_from_link] Error starting scrape:` ❌ Problem - check error details

**For `soundtrack_start_scrape`:**
1. Go to Edge Functions → `soundtrack_start_scrape` → Logs
2. Look for:
   - `[soundtrack_start_scrape] Request received` - Function is being called
   - `[soundtrack_start_scrape] Apify run started:` ✅ Good - Apify job created
   - `[soundtrack_start_scrape] Apify API error:` ❌ Problem - Apify token or config issue

### 3. Check Database for Scrape Jobs

Run this SQL in Supabase SQL Editor:
```sql
SELECT 
  id,
  sound_track_id,
  status,
  provider,
  created_at,
  started_at,
  finished_at,
  error,
  run_id
FROM sound_scrape_jobs
ORDER BY created_at DESC
LIMIT 10;
```

**What to look for:**
- **No rows**: Scraping was never initiated (check `soundtrack_create_from_link` logs)
- **Status = 'queued'**: Job created but Apify hasn't started it yet (wait 30-60 seconds)
- **Status = 'running'**: Scraping is active (check Apify dashboard)
- **Status = 'failed'**: Check the `error` column for details
- **Status = 'success'**: Scraping completed (check if webhook processed results)

### 4. Check Apify Configuration

**Verify Apify token is set:**
```bash
supabase secrets list
```
Look for `APIFY_API_TOKEN`. If missing:
```bash
supabase secrets set APIFY_API_TOKEN=your_token_here
```

**Check Apify Dashboard:**
1. Go to https://console.apify.com/actors/runs
2. Look for recent runs of `apidojo/tiktok-music-scraper`
3. Check run status:
   - **READY**: Waiting to start
   - **RUNNING**: Currently scraping
   - **SUCCEEDED**: Completed (check if webhook was called)
   - **FAILED**: Check error message

### 5. Check Webhook Configuration

**Verify webhook secret:**
```bash
supabase secrets list | grep APIFY_WEBHOOK_SECRET
```

If missing, set it:
```bash
supabase secrets set APIFY_WEBHOOK_SECRET=your_secret_here
```

**Check webhook function is deployed:**
```bash
supabase functions list | grep soundtrack_scrape_webhook
```

If missing:
```bash
supabase functions deploy soundtrack_scrape_webhook
```

### 6. Check if `sound_scrape_jobs` table exists

Run this SQL:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'sound_scrape_jobs'
);
```

If returns `false`, run the migration:
```sql
-- Check database/migrations/045_create_sound_scrape_jobs.sql
```

## Common Issues and Fixes

### Issue 1: "Function not found" or 404 error
**Symptom**: Logs show `404` or `Function not found` when calling `soundtrack_start_scrape`
**Fix**: Deploy the function:
```bash
supabase functions deploy soundtrack_start_scrape
```

### Issue 2: "APIFY_API_TOKEN not configured"
**Symptom**: Logs show missing Apify token
**Fix**: Set the secret:
```bash
supabase secrets set APIFY_API_TOKEN=your_apify_token
```

### Issue 3: "Apify API error: 401"
**Symptom**: Apify returns 401 Unauthorized
**Fix**: 
- Check your Apify token is valid at https://console.apify.com/account/integrations
- Regenerate token if needed
- Update secret: `supabase secrets set APIFY_API_TOKEN=new_token`

### Issue 4: "Table sound_scrape_jobs does not exist"
**Symptom**: Error when creating scrape job
**Fix**: Run migration `database/migrations/045_create_sound_scrape_jobs.sql`

### Issue 5: Job created but never starts
**Symptom**: Job status stays "queued" forever
**Possible causes:**
- Apify actor is down or rate-limited
- Invalid URL format sent to Apify
- Apify account has no credits

**Fix**: 
- Check Apify dashboard for the run
- Verify the URL format matches Apify's expected format
- Check Apify account credits/limits

### Issue 6: Scraping completes but no data appears
**Symptom**: Job shows "success" but UI shows no videos
**Possible causes:**
- Webhook not called or failed
- Webhook processed but didn't insert data
- Wrong `sound_track_id` in job

**Fix**: 
- Check `soundtrack_scrape_webhook` logs
- Check if `sound_track_videos` table has data:
  ```sql
  SELECT COUNT(*) FROM sound_track_videos WHERE sound_track_id = 'your_sound_track_id';
  ```

## Manual Test

To manually trigger scraping for an existing sound:

1. Get your sound track ID from the URL (e.g., `/sounds/abc123`)
2. Get the sound URL (from the sound detail page)
3. Call the function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/soundtrack_start_scrape \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "soundTrackId": "your_sound_track_id",
    "workspaceId": "your_workspace_id",
    "soundUrl": "https://www.tiktok.com/music/...",
    "maxItems": 200
  }'
```

Check the response and logs to see what happens.
