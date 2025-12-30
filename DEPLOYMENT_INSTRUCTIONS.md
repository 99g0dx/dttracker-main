# Deployment Instructions for Auto-Scraping

## Step 1: Deploy Edge Functions

### Option A: Using Supabase CLI (Recommended)

1. **Login to Supabase CLI:**
   ```bash
   supabase login
   ```
   This will open a browser for authentication.

2. **Link your project (if not already linked):**
   ```bash
   supabase link --project-ref ucbueapoexnxhttynfzy
   ```
   Replace `ucbueapoexnxhttynfzy` with your project reference if different.

3. **Deploy the functions:**
   ```bash
   # Deploy the scheduled scraping function
   supabase functions deploy scrape-all-scheduled
   
   # Deploy the updated scrape-post function
   supabase functions deploy scrape-post
   ```

### Option B: Using Supabase Dashboard

1. Go to **Edge Functions** in your Supabase Dashboard
2. For each function (`scrape-all-scheduled` and `scrape-post`):
   - Click **Create Function** (if new) or edit existing
   - Copy the contents from `supabase/functions/[function-name]/index.ts`
   - Paste into the editor
   - Click **Deploy**

## Step 2: Run Database Scripts

### Quick Method: Run Combined Script

1. Go to **Supabase Dashboard → SQL Editor**
2. Click **New Query**
3. Open `database/run_all_setup.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

### Alternative: Run Scripts Separately

If you prefer to run them separately:

1. **First:** Run `database/setup_auto_scraping.sql`
2. **Second:** Run `database/configure_auto_scraping.sql`
3. **Third:** Run `database/verify_auto_scraping.sql` to verify

## Step 3: Verify Everything Works

After running the database scripts, you should see:

- ✅ Extensions enabled (pg_cron, http)
- ✅ Database settings configured (URL and service role key)
- ✅ Trigger function created
- ✅ Cron job scheduled and active
- ✅ Indexes created

### Manual Verification

Run this query in SQL Editor:

```sql
-- Check cron job
SELECT * FROM cron.job WHERE jobname = 'daily-auto-scrape';

-- Check extensions
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'http');

-- Check function
SELECT proname FROM pg_proc WHERE proname = 'trigger_scheduled_scraping';
```

### Test the Scheduled Function

To test immediately (optional):

```sql
-- This will trigger scraping right now
SELECT trigger_scheduled_scraping();
```

## Step 4: Monitor Auto-Scraping

### Check Cron Job Execution History

```sql
SELECT 
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname = 'daily-auto-scrape'
ORDER BY start_time DESC
LIMIT 10;
```

### Check Historical Metrics

```sql
SELECT 
  DATE(scraped_at) as scrape_date,
  COUNT(*) as posts_scraped,
  SUM(views) as total_views
FROM post_metrics
WHERE scraped_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(scraped_at)
ORDER BY scrape_date DESC;
```

## Troubleshooting

### Edge Functions Not Deploying

- Make sure you're logged in: `supabase login`
- Check your project is linked: `supabase projects list`
- Verify you have the correct project reference

### Database Scripts Failing

- **"pg_cron extension not found"**: Enable it in Dashboard → Database → Extensions
- **"Permission denied"**: Make sure you're running as the postgres user
- **"Function already exists"**: This is fine, it will be replaced

### Cron Job Not Running

- Check if pg_cron is enabled
- Verify cron job is active: `SELECT active FROM cron.job WHERE jobname = 'daily-auto-scrape';`
- Check execution history for errors
- Verify database settings are configured correctly

### Function Returns Errors

- Check Edge Function logs in Dashboard → Edge Functions → Logs
- Verify `scrape-all-scheduled` function is deployed
- Check that RAPIDAPI_KEY secret is set in Edge Functions

## Next Steps

Once everything is deployed and verified:

1. ✅ Auto-scraping will run daily at 12:00 AM UTC
2. ✅ Historical metrics will be saved to `post_metrics` table
3. ✅ Charts will show daily growth from historical data
4. ✅ Manual scraping will still work without conflicts

## Support

If you encounter issues:
1. Check the verification script output
2. Review Edge Function logs
3. Check cron job execution history
4. See `AUTO_SCRAPING_SETUP.md` for detailed troubleshooting




