# Next Steps - Complete Sound Tracking Setup

Follow these steps in order to get everything working:

## ✅ Step 1: Deploy All Functions

Run these commands in your terminal:

```bash
# Make sure you're logged in
supabase login

# Deploy the three required functions
supabase functions deploy soundtrack_start_scrape
supabase functions deploy soundtrack_scrape_webhook
supabase functions deploy soundtrack_job_runner
```

**Verify:** Run `./check-scraping-status.sh` - you should see ✅ for all three functions

## ✅ Step 2: Set Apify Secrets

```bash
# Get your Apify token from: https://console.apify.com/account/integrations
supabase secrets set APIFY_API_TOKEN=your_apify_token_here

# Optional but recommended
supabase secrets set APIFY_WEBHOOK_SECRET=any_random_string_here
```

**Verify:** Run `./check-scraping-status.sh` - you should see ✅ for APIFY_API_TOKEN

## ✅ Step 3: Set Up Cron Job

**Option A: Using Supabase Dashboard (Easiest)**

1. Go to: **Supabase Dashboard** → **Database** → **Cron Jobs**
2. Click **"New Cron Job"** or **"Add Cron Job"**
3. Fill in:
   - **Name**: `soundtrack-job-runner`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Command**: 
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/soundtrack_job_runner',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
       ),
       body := '{}'::jsonb
     ) AS request_id;
     ```
   - **Replace placeholders:**
     - `YOUR_PROJECT_REF` → Find in Dashboard → Settings → API → Project URL
     - `YOUR_SERVICE_ROLE_KEY` → Find in Dashboard → Settings → API → service_role key
4. Click **Save**

**Option B: Using SQL Editor**

1. Go to: **Supabase Dashboard** → **SQL Editor**
2. Open `database/setup_soundtrack_cron_simple.sql`
3. Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values
4. Run the script

**Verify:** Check Edge Function logs for `soundtrack_job_runner` - you should see logs every 5 minutes

## ✅ Step 4: Test Everything

### Test 1: Create a New Sound
1. Go to your app → `/sounds/new`
2. Paste a TikTok music URL (e.g., `https://www.tiktok.com/music/Everyday-7595744832015730704`)
3. Click "Track Sound"
4. **Expected:** 
   - Sound is created
   - Blue banner shows "Scraping in progress..."
   - Check Supabase logs for `✅ Scrape job started`

### Test 2: Check Apify Dashboard
1. Go to: https://console.apify.com/actors/runs
2. **Expected:** You should see a new run for `apidojo/tiktok-music-scraper`
3. Wait 5-10 minutes for it to complete

### Test 3: Verify Results
1. Go back to your app → Sound detail page
2. **Expected:**
   - Videos appear in "Videos Using This Sound" section
   - Stats show in KPI cards
   - No more "No posts found yet" message

### Test 4: Test Job Runner
1. Click "Refresh Now" on a sound
2. Check Supabase SQL Editor:
   ```sql
   SELECT * FROM sound_track_jobs WHERE status = 'queued' LIMIT 5;
   ```
3. Wait up to 5 minutes
4. Check again - jobs should be processed (status = 'success' or 'failed')
5. **Expected:** Posts appear in "Posts Using This Sound" tabs

## 🐛 Troubleshooting

### If scraping doesn't start:
- ✅ Check: Functions are deployed (`./check-scraping-status.sh`)
- ✅ Check: `APIFY_API_TOKEN` is set
- ✅ Check: Edge Function logs for errors

### If jobs aren't processing:
- ✅ Check: `soundtrack_job_runner` is deployed
- ✅ Check: Cron job is set up and running
- ✅ Check: Jobs exist in `sound_track_jobs` table
- ✅ Check: Job runner logs for errors

### If no videos appear:
- ✅ Check: Apify dashboard shows successful run
- ✅ Check: `soundtrack_scrape_webhook` logs
- ✅ Check: `sound_track_videos` table has data

## 📋 Quick Checklist

- [ ] Deployed `soundtrack_start_scrape`
- [ ] Deployed `soundtrack_scrape_webhook`
- [ ] Deployed `soundtrack_job_runner`
- [ ] Set `APIFY_API_TOKEN` secret
- [ ] Set `APIFY_WEBHOOK_SECRET` secret (optional)
- [ ] Set up cron job (Dashboard or SQL)
- [ ] Tested creating a sound
- [ ] Verified Apify run started
- [ ] Verified videos appear after scraping
- [ ] Verified jobs are being processed

## 🎉 Once Everything Works

The system will:
- ✅ Automatically scrape when sounds are created
- ✅ Process queued jobs every 5 minutes
- ✅ Update posts and metrics automatically
- ✅ Show all data in the UI with proper loading states

You're all set! 🚀
