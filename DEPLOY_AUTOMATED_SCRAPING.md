# Deploy Automated Sound Scraping

## Quick Setup

### 1. Run Database Migration

In Supabase SQL Editor, run:
```sql
-- database/migrations/045_create_sound_scrape_jobs.sql
```

This creates:
- `sound_scrape_jobs` table
- `sound_track_stats` table  
- `sound_track_videos` table
- RLS policies

### 2. Deploy Edge Functions

```bash
# Deploy scrape starter
supabase functions deploy soundtrack_start_scrape

# Deploy webhook handler
supabase functions deploy soundtrack_scrape_webhook

# Update existing function (already modified)
supabase functions deploy soundtrack_create_from_link
```

### 3. Set Secrets

```bash
# Apify token (you already have this)
supabase secrets set APIFY_API_TOKEN="apify_api_PRJ472UAbkuq4i9RyQntOzLDn9jS9a2wPaOE"

# Webhook secret (generate a random string)
supabase secrets set APIFY_WEBHOOK_SECRET="your-random-secret-here"

# Supabase config (if not already set)
supabase secrets set SB_URL="https://ucbueapoexnxhttynfzy.supabase.co"
supabase secrets set SB_SERVICE_ROLE_KEY="your-service-role-key"
```

### 4. Configure Apify Webhook (Optional)

You can also set webhooks in Apify Console:
1. Go to https://console.apify.com
2. Find `apidojo/tiktok-music-scraper`
3. Go to Settings → Webhooks
4. Add webhook:
   - URL: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/soundtrack_scrape_webhook`
   - Events: `ACTOR.RUN.SUCCEEDED`, `ACTOR.RUN.FAILED`
   - Payload: Include `runId`, `status`, `defaultDatasetId`, `secret`

**Note:** The function already configures webhooks automatically, so this is optional.

## How It Works

1. **User creates sound track** → `soundtrack_create_from_link`
2. **Automatically starts scrape** → `soundtrack_start_scrape`
3. **Apify runs** → Scrapes videos using the sound
4. **Webhook called** → `soundtrack_scrape_webhook` receives results
5. **Results stored** → Videos and stats saved to Supabase
6. **UI updates** → User sees results automatically

## Testing

1. Go to `/sounds/new`
2. Paste: `https://www.tiktok.com/music/Everyday-7595744832015730704`
3. Click "Start Tracking"
4. **Automatically:**
   - Sound created ✅
   - Scrape job started ✅
   - Apify scraping... ⏳
   - Results appear when ready ✅

## Monitoring

Check job status:
```sql
SELECT id, status, run_id, started_at, finished_at, error
FROM sound_scrape_jobs
WHERE sound_track_id = 'your-sound-track-id'
ORDER BY created_at DESC;
```

Check results:
```sql
SELECT COUNT(*) as video_count
FROM sound_track_videos
WHERE sound_track_id = 'your-sound-track-id';

SELECT * FROM sound_track_stats
WHERE sound_track_id = 'your-sound-track-id';
```

## Troubleshooting

### Webhook not called
- Check Apify run logs
- Verify webhook URL is accessible
- Check `APIFY_WEBHOOK_SECRET` matches

### Job stuck in "running"
- Check Apify dashboard for run status
- Verify webhook endpoint is deployed
- Check Edge Function logs

### No videos appearing
- Check `sound_track_videos` table
- Verify Apify returned data
- Check webhook function logs

## Security Notes

✅ **Webhook secret verification** - Prevents unauthorized webhook calls
✅ **Service role key** - Only Edge Functions can write to tables
✅ **RLS policies** - Users can only see their workspace data
✅ **No frontend API keys** - All Apify calls are server-side
