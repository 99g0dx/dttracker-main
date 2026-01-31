# Complete Sound Tracking Setup Guide

This guide covers all the missing pieces to get sound tracking fully working.

## ✅ What's Already Done
- ✅ Frontend UI components
- ✅ `soundtrack_create_from_link` function
- ✅ `soundtrack_refresh_sound` function
- ✅ `soundtrack_discover_and_refresh_posts` function
- ✅ Database tables (sound_tracks, sound_track_snapshots, sound_track_posts, sound_scrape_jobs)

## ❌ What's Missing (Fix These)

### 1. Deploy Apify Functions

```bash
# Login first (if you haven't already)
supabase login

# Deploy the scraping functions
supabase functions deploy soundtrack_start_scrape
supabase functions deploy soundtrack_scrape_webhook
```

### 2. Set Apify Secrets

```bash
# Get your Apify token from: https://console.apify.com/account/integrations
supabase secrets set APIFY_API_TOKEN=your_apify_token_here

# Optional but recommended
supabase secrets set APIFY_WEBHOOK_SECRET=your_random_secret_here
```

### 3. Deploy Job Runner

```bash
# Deploy the job runner that processes queued jobs
supabase functions deploy soundtrack_job_runner
```

### 4. Set Up Cron Job

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to: Supabase Dashboard → Database → Cron Jobs
2. Click "New Cron Job"
3. Configure:
   - **Name**: `soundtrack-job-runner`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Command**: Use HTTP request to call `https://YOUR_PROJECT.supabase.co/functions/v1/soundtrack_job_runner`
   - **Headers**: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

**Option B: Using SQL**
1. Go to: Supabase Dashboard → SQL Editor
2. Open `database/setup_soundtrack_cron_simple.sql`
3. Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values
4. Run the script

### 5. Verify Everything

```bash
# Run the check script
./check-scraping-status.sh
```

You should see all ✅ green checkmarks.

## 📋 Quick Command Summary

```bash
# 1. Login
supabase login

# 2. Deploy all functions
supabase functions deploy soundtrack_start_scrape
supabase functions deploy soundtrack_scrape_webhook
supabase functions deploy soundtrack_job_runner

# 3. Set secrets
supabase secrets set APIFY_API_TOKEN=your_token
supabase secrets set APIFY_WEBHOOK_SECRET=your_secret

# 4. Verify
./check-scraping-status.sh
```

## 🔍 How It All Works

### Apify Scraping Flow:
1. User creates sound → `soundtrack_create_from_link` creates sound
2. Function automatically calls `soundtrack_start_scrape`
3. `soundtrack_start_scrape` creates Apify run and records job in `sound_scrape_jobs`
4. Apify scrapes videos in background
5. When done, Apify calls `soundtrack_scrape_webhook`
6. Webhook processes results and writes to `sound_track_videos` and `sound_track_stats`
7. UI automatically shows videos when they appear

### Job Runner Flow:
1. `soundtrack_refresh_sound` enqueues `discover_posts` job in `sound_track_jobs`
2. Cron job calls `soundtrack_job_runner` every 5 minutes
3. Job runner processes queued jobs:
   - `discover_posts` → calls `soundtrack_discover_and_refresh_posts`
   - `refresh_post_metrics` → refreshes metrics for posts
4. Results update `sound_track_posts` and `sound_track_post_snapshots`
5. UI shows updated data

## 🧪 Testing

After setup:

1. **Test Apify Scraping:**
   - Create a new sound in the app
   - Check Supabase logs for `✅ Scrape job started`
   - Check Apify dashboard for the run
   - Wait 5-10 minutes for results

2. **Test Job Runner:**
   - Click "Refresh Now" on a sound
   - Check `sound_track_jobs` table in SQL Editor
   - Wait up to 5 minutes for cron to run
   - Check logs for `soundtrack_job_runner`

3. **Verify Data:**
   - Videos should appear in "Videos Using This Sound" section
   - Posts should appear in "Posts Using This Sound" tabs
   - Stats should show in KPI cards

## 🐛 Troubleshooting

### Scraping Not Starting
- Check: `soundtrack_start_scrape` is deployed
- Check: `APIFY_API_TOKEN` is set
- Check: Edge Function logs for errors

### Jobs Not Processing
- Check: `soundtrack_job_runner` is deployed
- Check: Cron job is set up and running
- Check: `sound_track_jobs` table has queued jobs
- Check: Job runner logs for errors

### No Videos Appearing
- Check: Apify dashboard shows successful run
- Check: `soundtrack_scrape_webhook` logs
- Check: `sound_track_videos` table has data
- Check: `sound_scrape_jobs` status is 'success'

## 📚 Files Created

- `supabase/functions/soundtrack_job_runner/index.ts` - Job processor
- `database/migrations/046_setup_soundtrack_job_runner_cron.sql` - Cron setup (advanced)
- `database/setup_soundtrack_cron_simple.sql` - Cron setup (simple)
- `COMPLETE_SETUP_GUIDE.md` - This file
