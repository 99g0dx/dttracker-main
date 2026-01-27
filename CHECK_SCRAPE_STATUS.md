# How to Check Why Scraping Isn't Working

## Step 1: Check Supabase SQL Editor (NOT Terminal)

SQL commands must be run in the **Supabase Dashboard SQL Editor**, not in your terminal.

### How to Access SQL Editor:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Run This Query to Check Scrape Jobs:

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

**What the results mean:**
- **No rows returned**: Scraping was never started. Check Edge Function logs.
- **status = 'queued'**: Job created, waiting for Apify to start (normal, wait 30-60 seconds)
- **status = 'running'**: Scraping is active (check Apify dashboard)
- **status = 'failed'**: Check the `error` column
- **status = 'success'**: Scraping completed (check if webhook processed it)

## Step 2: Check Edge Function Logs

### For `soundtrack_create_from_link`:
1. Go to Supabase Dashboard → **Edge Functions** → `soundtrack_create_from_link` → **Logs** tab
2. Look for recent logs when you created the sound
3. Search for:
   - `✅ Scrape job started successfully` = Good!
   - `❌ Failed to start scrape job` = Problem - check error details
   - `Skipping scrape job` = Missing requirements

### For `soundtrack_start_scrape`:
1. Go to **Edge Functions** → `soundtrack_start_scrape` → **Logs** tab
2. Look for:
   - `[soundtrack_start_scrape] Request received` = Function was called
   - `[soundtrack_start_scrape] Apify run started:` = Apify job created
   - `[soundtrack_start_scrape] Apify API error:` = Apify token or config issue

## Step 3: Check Functions Are Deployed

Run this in your **terminal** (not SQL):

```bash
supabase functions list
```

You should see:
- `soundtrack_create_from_link`
- `soundtrack_start_scrape`  
- `soundtrack_scrape_webhook`

If any are missing, deploy them:
```bash
supabase functions deploy soundtrack_start_scrape
supabase functions deploy soundtrack_scrape_webhook
```

## Step 4: Check Apify Token

Run this in your **terminal**:

```bash
supabase secrets list | grep APIFY
```

Should show `APIFY_API_TOKEN`. If missing:
```bash
supabase secrets set APIFY_API_TOKEN=your_token_here
```

## Step 5: Check if Table Exists

In **Supabase SQL Editor**, run:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'sound_scrape_jobs'
);
```

If returns `false`, the table doesn't exist. Run the migration:
1. Go to **SQL Editor**
2. Open `database/migrations/045_create_sound_scrape_jobs.sql`
3. Copy and paste the entire file
4. Click **Run**

## Quick Diagnostic Checklist

- [ ] `sound_scrape_jobs` table exists (check SQL Editor)
- [ ] `soundtrack_start_scrape` function is deployed (check `supabase functions list`)
- [ ] `APIFY_API_TOKEN` secret is set (check `supabase secrets list`)
- [ ] Scrape job exists in database (check SQL Editor query above)
- [ ] Edge Function logs show scraping was attempted (check Dashboard logs)
- [ ] Apify dashboard shows a run (check https://console.apify.com/actors/runs)

## Most Common Issues

### Issue 1: Table Doesn't Exist
**Fix**: Run `database/migrations/045_create_sound_scrape_jobs.sql` in SQL Editor

### Issue 2: Function Not Deployed
**Fix**: `supabase functions deploy soundtrack_start_scrape`

### Issue 3: Missing Apify Token
**Fix**: `supabase secrets set APIFY_API_TOKEN=your_token`

### Issue 4: Scraping Started But Stuck
**Check**: Apify dashboard at https://console.apify.com/actors/runs
- If run is stuck, check Apify account credits/limits
- If run failed, check error message in Apify dashboard
