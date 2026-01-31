# Sound Tracking Feature - Setup Checklist

Complete this checklist in order to get the sound tracking feature working.

## ✅ Phase 1: Database Setup

### 1.1 Run Database Migration
- [ ] Execute the migration script:
  ```bash
  psql "$SUPABASE_DB_URL" -f database/migrations/042_create_sound_tracking_tables.sql
  ```
- [ ] Verify tables were created:
  ```bash
  psql "$SUPABASE_DB_URL" -f database/verify_sound_tracking_setup.sql
  ```
- [ ] Confirm all 5 tables exist:
  - `sound_tracks`
  - `sound_track_snapshots`
  - `sound_track_posts`
  - `sound_track_post_snapshots`
  - `sound_track_jobs`

### 1.2 Enable Required Extensions
- [ ] Enable `pg_cron` extension (for job scheduling):
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  ```
- [ ] Enable `http` extension (for external API calls from DB):
  ```sql
  CREATE EXTENSION IF NOT EXISTS http;
  ```

### 1.3 Set Up Cron Job for Job Runner
- [ ] Run the cron setup script:
  ```bash
  psql "$SUPABASE_DB_URL" -f database/setup_soundtrack_job_runner_cron.sql
  ```
- [ ] Verify cron job is active:
  ```sql
  SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'soundtrack-job-runner';
  ```
- [ ] Expected: Job runs every 5 minutes and is active

### 1.4 Fix RLS Policies (if needed)
- [ ] If you get 403 errors, run the fix script:
  ```bash
  psql "$SUPABASE_DB_URL" -f database/fix_403_error.sql
  ```

---

## ✅ Phase 2: Configure Secrets

### 2.1 Required Secrets for All Platforms
Run these commands to set your secrets:

```bash
# Supabase credentials
supabase secrets set SB_URL="your-supabase-url"
supabase secrets set SB_ANON_KEY="your-anon-key"
supabase secrets set SB_SERVICE_ROLE_KEY="your-service-role-key"
```

**Checklist:**
- [ ] `SB_URL` is set
- [ ] `SB_ANON_KEY` is set
- [ ] `SB_SERVICE_ROLE_KEY` is set

### 2.2 TikTok Support (Apify)
```bash
supabase secrets set APIFY_API_TOKEN="your-apify-token"
supabase secrets set APIFY_TIKTOK_ACTOR_ID="your-tiktok-actor-id"
```

**Checklist:**
- [ ] `APIFY_API_TOKEN` is set
- [ ] `APIFY_TIKTOK_ACTOR_ID` is set
- [ ] TikTok actor exists in your Apify account

### 2.3 Instagram Support (RapidAPI)
```bash
supabase secrets set RAPIDAPI_KEY="your-rapidapi-key"
```

**Checklist:**
- [ ] `RAPIDAPI_KEY` is set
- [ ] RapidAPI subscription is active for Instagram API

### 2.4 YouTube Support (YouTube Data API)
```bash
supabase secrets set YOUTUBE_API_KEY="your-youtube-api-key"
```

**Checklist:**
- [ ] `YOUTUBE_API_KEY` is set
- [ ] YouTube Data API v3 is enabled in Google Cloud Console
- [ ] API quota is sufficient

### 2.5 Verify All Secrets
- [ ] Run `supabase secrets list` and confirm all required secrets are present

---

## ✅ Phase 3: Deploy Edge Functions

### 3.1 Deploy All Four Edge Functions
```bash
# Deploy all at once
supabase functions deploy soundtrack_create_from_link \
  soundtrack_refresh_sound \
  soundtrack_discover_and_refresh_posts \
  soundtrack_job_runner

# OR deploy individually
supabase functions deploy soundtrack_create_from_link
supabase functions deploy soundtrack_refresh_sound
supabase functions deploy soundtrack_discover_and_refresh_posts
supabase functions deploy soundtrack_job_runner
```

**Checklist:**
- [ ] `soundtrack_create_from_link` deployed successfully
- [ ] `soundtrack_refresh_sound` deployed successfully
- [ ] `soundtrack_discover_and_refresh_posts` deployed successfully
- [ ] `soundtrack_job_runner` deployed successfully
- [ ] No deployment errors in terminal

### 3.2 Verify Edge Functions
- [ ] Go to Supabase Dashboard → Edge Functions
- [ ] Confirm all 4 functions are listed and active
- [ ] Check that each function has the correct secrets attached

---

## ✅ Phase 4: Fix Known Issues

### 4.1 Fix Job Runner Bug (CRITICAL)
**This bug prevents all jobs from processing!**

- [x] Fixed: Changed `soundtrack_job_runner/index.ts` line 162 to extract `workspace_id` from job root level instead of payload

Verify the fix is in place:
```typescript
// Line 162 should look like this:
const { soundTrackId, postPlatformId, platform } = job.payload;
const workspaceId = job.workspace_id;  // ✅ Correct

// NOT like this:
const { workspaceId, soundTrackId, ... } = job.payload;  // ❌ Wrong
```

### 4.2 Fix Timeout Issues (if "EarlyDrop" errors occur)
The `soundtrack_create_from_link` function may timeout if Apify takes too long.

**Solutions:**
- [ ] Option A: Reduce Apify `waitForFinish` timeout to 30 seconds or less
- [ ] Option B: Make provider calls non-blocking (return immediately, let job runner process)
- [ ] Option C: Show "pending" state immediately, refresh in background

Check [soundtrack_create_from_link/index.ts](supabase/functions/soundtrack_create_from_link/index.ts#L101) line 101 for timeout settings.

---

## ✅ Phase 5: Test the Feature

### 5.1 Manual Test: Create Sound Track
1. [ ] Navigate to `/sounds` in your app
2. [ ] Click "Track a Sound"
3. [ ] Paste a TikTok/Instagram/YouTube URL
4. [ ] Click "Start Tracking"
5. [ ] Verify: No errors, redirects to sound detail page

### 5.2 Verify Jobs Are Created
```sql
-- Check if jobs were queued
SELECT id, job_type, status, created_at, payload
FROM sound_track_jobs
WHERE workspace_id = 'your-workspace-id'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- [ ] At least 2 jobs created: `refresh_sound` and `discover_posts`
- [ ] Jobs have `status = 'queued'`
- [ ] `workspace_id` is at the root level (not in payload)

### 5.3 Wait for Job Runner (5 minutes)
- [ ] Wait 5 minutes for cron to trigger
- [ ] Check job status again:
  ```sql
  SELECT id, job_type, status, last_error
  FROM sound_track_jobs
  WHERE workspace_id = 'your-workspace-id'
  ORDER BY created_at DESC;
  ```
- [ ] Expected: `status = 'success'` or `status = 'running'`

### 5.4 Verify Data Appears
- [ ] Refresh the sound detail page
- [ ] Confirm snapshots appear in `sound_track_snapshots` table
- [ ] Confirm posts appear in `sound_track_posts` table
- [ ] Verify KPIs display on the UI (total uses, 24h change, etc.)

### 5.5 Test Manual Refresh
- [ ] Click "Refresh Now" button on sound detail page
- [ ] Verify new job is queued
- [ ] Wait for processing and check for new snapshot

---

## ✅ Phase 6: Troubleshooting

### 6.1 Check Edge Function Logs
If anything fails:
1. [ ] Go to Supabase Dashboard → Edge Functions
2. [ ] Click on the function that's failing
3. [ ] View "Logs" tab
4. [ ] Look for error messages

**Common errors:**
- `401 Unauthorized` → Check auth tokens/secrets
- `403 Forbidden` → RLS policy issue, run fix script
- `EarlyDrop` → Function timeout, reduce wait time
- `relation does not exist` → Migration didn't run

### 6.2 Check Job Runner Logs
```bash
psql "$SUPABASE_DB_URL" -f database/test_soundtrack_job_runner.sql
```

Or check cron execution logs:
```sql
SELECT jobname, start_time, end_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'soundtrack-job-runner'
ORDER BY start_time DESC
LIMIT 10;
```

### 6.3 Check for Locked Jobs
```sql
-- Find stuck jobs
SELECT id, job_type, status, locked_at, locked_by, last_error
FROM sound_track_jobs
WHERE locked_at IS NOT NULL
  AND locked_at < NOW() - INTERVAL '10 minutes';
```

- [ ] If jobs are stuck, unlock them:
  ```sql
  UPDATE sound_track_jobs
  SET locked_at = NULL, locked_by = NULL
  WHERE locked_at < NOW() - INTERVAL '10 minutes';
  ```

### 6.4 Manual Job Runner Trigger (for testing)
```bash
curl -X POST "https://your-project-ref.supabase.co/functions/v1/soundtrack_job_runner" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## ✅ Phase 7: Production Readiness

### 7.1 Performance Optimization
- [ ] Index verification: Run `\d+ sound_tracks` to confirm indexes exist
- [ ] Consider adding more frequent cron (every 2-3 minutes) for faster updates
- [ ] Monitor API rate limits (Apify, RapidAPI, YouTube)

### 7.2 Monitoring Setup
- [ ] Set up alerts for failed jobs (>10 failures per hour)
- [ ] Monitor edge function error rates
- [ ] Track API quota usage

### 7.3 User-Facing Polish
- [ ] Add loading states to UI
- [ ] Show "Data Pending" banner when snapshots don't exist
- [ ] Display error messages gracefully
- [ ] Add refresh button cooldown (prevent spam)

---

## 🎯 Quick Verification Script

Run this all-in-one verification:

```bash
# 1. Check tables
psql "$SUPABASE_DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'sound_%';"

# 2. Check cron
psql "$SUPABASE_DB_URL" -c "SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'soundtrack-job-runner';"

# 3. Check secrets
supabase secrets list | grep -E "(SB_|APIFY|RAPID|YOUTUBE)"

# 4. Check functions
supabase functions list

# 5. Check recent jobs
psql "$SUPABASE_DB_URL" -c "SELECT job_type, status, COUNT(*) FROM sound_track_jobs GROUP BY job_type, status;"
```

---

## 📋 Summary Checklist

- [ ] All 5 database tables exist
- [ ] RLS policies are active and correct
- [ ] `pg_cron` extension is enabled
- [ ] Cron job is scheduled and active
- [ ] All 6+ secrets are configured
- [ ] All 4 edge functions are deployed
- [ ] Job runner bug fix is applied
- [ ] Can create a sound track without errors
- [ ] Jobs are queued successfully
- [ ] Job runner processes jobs (check after 5 min)
- [ ] Snapshots and posts appear in database
- [ ] UI displays data correctly

---

## 🆘 Still Not Working?

1. Run the full verification script (database/verify_sound_tracking_setup.sql)
2. Check Edge Function logs for specific errors
3. Test job runner manually with test_soundtrack_job_runner.sql
4. Review TROUBLESHOOT_JOB_RUNNER.md for common issues
5. Check that your workspace_id matches the authenticated user

**Most common issue:** Migration not run → tables don't exist → everything fails
**Second most common:** Job runner bug not fixed → jobs never process → no data
