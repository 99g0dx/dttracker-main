# Auto-Scraping Setup Guide

This guide explains how to set up automatic daily scraping at 12:00 AM UTC for all active posts in your campaigns.

## Overview

The auto-scraping system consists of:
1. **Scheduled Edge Function** (`scrape-all-scheduled`) - Scrapes all active posts
2. **Database Cron Job** (pg_cron) - Triggers the function daily at 12:00 AM UTC
3. **Historical Metrics** - Saves snapshots to `post_metrics` table for growth tracking

## Prerequisites

- Supabase project with Edge Functions enabled
- `pg_cron` extension enabled in your database
- `RAPIDAPI_KEY` secret configured in Supabase
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets configured

## Step 1: Deploy Edge Functions

### Deploy the Scheduled Scraping Function

```bash
# Deploy the new scheduled scraping function
supabase functions deploy scrape-all-scheduled

# Update the existing scrape-post function (if not already deployed)
supabase functions deploy scrape-post
```

### Verify Deployment

1. Go to your Supabase Dashboard → Edge Functions
2. Verify both functions are listed:
   - `scrape-post`
   - `scrape-all-scheduled`

## Step 2: Enable pg_cron Extension

### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Database** → **Extensions**
2. Search for "pg_cron"
3. Click **Enable** if not already enabled
4. If not available, contact Supabase support to enable it

### Option B: Via SQL

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## Step 3: Configure Database Settings

You need to set your Supabase URL and service role key so the cron job can call the Edge Function.

### Quick Setup (Recommended)

1. Open `database/configure_auto_scraping.sql`
2. Replace the placeholder values with your actual:
   - Supabase Project URL (from Dashboard → Settings → API → Project URL)
   - Service Role Key (from Dashboard → Settings → API → Service Role key)
3. Run the script in Supabase SQL Editor

### Option A: Database Settings (Recommended)

Run the provided configuration script:

```bash
# Edit database/configure_auto_scraping.sql with your values, then run it
```

Or manually run these SQL commands in your Supabase SQL Editor:

```sql
-- Set Supabase URL (replace with your project URL)
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';

-- Set service role key (replace with your actual key)
-- Note: This is sensitive - keep it secure!
ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key-here';
```

**To find your service role key:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the "service_role" key (keep it secret!)

### Option B: Hardcode in Function (Less Secure)

If you prefer, you can hardcode the values directly in `database/setup_auto_scraping.sql`:

```sql
-- In trigger_scheduled_scraping() function (around line 62-63), uncomment and update:
supabase_url := 'https://your-project.supabase.co';
service_role_key := 'your-service-role-key-here';
```

Then comment out the database settings section (lines 51-58).

## Step 4: Run Database Migration

Run the migration script to set up the cron job:

```bash
# Using Supabase CLI
supabase db push database/setup_auto_scraping.sql

# OR using psql
psql -h db.your-project.supabase.co -U postgres -d postgres -f database/setup_auto_scraping.sql
```

**OR** copy and paste the SQL from `database/setup_auto_scraping.sql` into the Supabase SQL Editor and run it.

## Step 5: Verify Setup

### Quick Verification

Run the provided verification script:

```bash
# Run database/verify_auto_scraping.sql in Supabase SQL Editor
```

This will check all components and provide a summary.

### Manual Verification

#### Check Cron Job

Run this query in your Supabase SQL Editor:

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'daily-auto-scrape';
```

You should see:
- `jobname`: `daily-auto-scrape`
- `schedule`: `0 0 * * *` (12:00 AM UTC daily)
- `active`: `true`

### Test the Scheduled Function Manually

You can test the function by calling it directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/scrape-all-scheduled \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Or use the Supabase Dashboard:
1. Go to **Edge Functions** → `scrape-all-scheduled`
2. Click **Invoke Function**
3. Use service role key for authentication

### Check Cron Job Execution History

```sql
SELECT 
  jobid,
  jobname,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname = 'daily-auto-scrape'
ORDER BY start_time DESC
LIMIT 10;
```

**Or use the verification script:**
- Run `database/verify_auto_scraping.sql` for a complete check

## Troubleshooting

### Issue: "pg_cron extension not found"

**Solution:**
- Contact Supabase support to enable `pg_cron` extension
- Or use alternative method (external cron service) - see below

### Issue: "Supabase URL not configured"

**Solution:**
- Make sure you've set `app.supabase_url` database setting
- Or hardcode it in the function (see Step 3)

### Issue: "Service role key not configured"

**Solution:**
- Make sure you've set `app.service_role_key` database setting
- Or hardcode it in the function (see Step 3)
- Verify the key is correct in Supabase Dashboard → Settings → API

### Issue: Cron job not running

**Check:**
1. Verify `pg_cron` extension is enabled
2. Check cron job is active: `SELECT * FROM cron.job WHERE jobname = 'daily-auto-scrape';`
3. Check execution history for errors: `SELECT * FROM cron.job_run_details WHERE jobname = 'daily-auto-scrape' ORDER BY start_time DESC LIMIT 5;`
4. Verify database settings are correct

### Issue: Function returns 401 Unauthorized

**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` secret is set in Edge Functions
- Check that the service role key in database settings matches the secret

### Issue: No posts being scraped

**Check:**
1. Verify you have active campaigns: `SELECT * FROM campaigns WHERE status = 'active';`
2. Verify posts exist: `SELECT * FROM posts WHERE campaign_id IN (SELECT id FROM campaigns WHERE status = 'active');`
3. Check function logs in Supabase Dashboard → Edge Functions → Logs

## Alternative: External Cron Service

If `pg_cron` is not available or you prefer external scheduling, you can use an external cron service:

### Using cron-job.org

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://your-project.supabase.co/functions/v1/scrape-all-scheduled`
   - **Schedule**: Daily at 12:00 AM UTC
   - **Method**: POST
   - **Headers**:
     - `Authorization`: `Bearer YOUR_SERVICE_ROLE_KEY`
     - `apikey`: `YOUR_SERVICE_ROLE_KEY`
     - `Content-Type`: `application/json`
   - **Body**: `{}`

### Using GitHub Actions

Create `.github/workflows/auto-scrape.yml`:

```yaml
name: Auto Scrape Daily

on:
  schedule:
    - cron: '0 0 * * *'  # 12:00 AM UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Scraping
        run: |
          curl -X POST https://${{ secrets.SUPABASE_URL }}/functions/v1/scrape-all-scheduled \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

Add secrets in GitHub repository settings:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

## Monitoring

### Check Last Scrape Time

```sql
SELECT 
  MAX(scraped_at) as last_scrape_time,
  COUNT(*) as total_snapshots
FROM post_metrics;
```

### Check Recent Scraping Activity

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

### View Cron Job Status

```sql
SELECT 
  jobname,
  schedule,
  active,
  (SELECT MAX(start_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run,
  (SELECT status FROM cron.job_run_details WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1) as last_status
FROM cron.job j
WHERE jobname = 'daily-auto-scrape';
```

## Timezone Configuration

Currently, the cron job runs at **12:00 AM UTC** daily. To change the timezone:

1. Calculate the UTC time equivalent to your desired local time
2. Update the cron expression in `database/setup_auto_scraping.sql`:
   ```sql
   -- Example: 12:00 AM EST (UTC-5) = 5:00 AM UTC
   SELECT cron.schedule(
     'daily-auto-scrape',
     '0 5 * * *',  -- 5:00 AM UTC = 12:00 AM EST
     $$SELECT trigger_scheduled_scraping();$$
   );
   ```

**Common timezone conversions:**
- EST (UTC-5): `'0 5 * * *'` (5:00 AM UTC)
- PST (UTC-8): `'0 8 * * *'` (8:00 AM UTC)
- GMT (UTC+0): `'0 0 * * *'` (12:00 AM UTC)

## Manual Trigger

To manually trigger auto-scraping (for testing):

```sql
SELECT trigger_scheduled_scraping();
```

Or via Edge Function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/scrape-all-scheduled \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY"
```

## Disabling Auto-Scraping

To temporarily disable auto-scraping:

```sql
-- Disable the cron job
UPDATE cron.job SET active = false WHERE jobname = 'daily-auto-scrape';
```

To re-enable:

```sql
UPDATE cron.job SET active = true WHERE jobname = 'daily-auto-scrape';
```

To permanently remove:

```sql
SELECT cron.unschedule('daily-auto-scrape');
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Edge Function logs in Supabase Dashboard
3. Check cron job execution history
4. Verify all secrets and settings are configured correctly

