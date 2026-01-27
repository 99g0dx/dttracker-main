# How to Set Up Cron Job for Soundtrack Job Runner

## Option 1: Using Supabase Dashboard (Easiest - Recommended)

1. Go to **Supabase Dashboard** → **Database** → **Cron Jobs**
2. Click **"New Cron Job"** or **"Add Cron Job"**
3. Fill in:
   - **Name**: `soundtrack-job-runner`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Command**: See the SQL below (replace placeholders)
4. Click **Save**

**Command to use:**
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

**Where to find values:**
- **YOUR_PROJECT_REF**: Dashboard → Settings → API → Project URL (the part before `.supabase.co`)
- **YOUR_SERVICE_ROLE_KEY**: Dashboard → Settings → API → `service_role` key (the `secret` one, not `anon`)

## Option 2: Using SQL Editor (Manual)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `database/setup_soundtrack_cron_simple.sql`
3. **Replace these placeholders:**
   - `YOUR_PROJECT_REF` → Your actual project reference
   - `YOUR_SERVICE_ROLE_KEY` → Your actual service role key
4. Run the script

## Option 3: External Cron Service (If pg_cron not available)

Use a service like **cron-job.org** or **EasyCron**:

1. Create account at cron-job.org
2. Create new cron job:
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/soundtrack_job_runner`
   - **Schedule**: Every 5 minutes
   - **Method**: POST
   - **Headers**: 
     - `Content-Type: application/json`
     - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - **Body**: `{}`

## Verify Cron is Working

After setting up, check if jobs are being processed:

1. **Check job runner logs:**
   - Dashboard → Edge Functions → `soundtrack_job_runner` → Logs
   - Should see logs every 5 minutes

2. **Check job table:**
   ```sql
   SELECT 
     id,
     job_type,
     status,
     created_at,
     updated_at
   FROM sound_track_jobs
   WHERE status IN ('queued', 'running')
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Manually trigger to test:**
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/soundtrack_job_runner \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

## Troubleshooting

### "pg_cron extension not available"
- Use **Option 1** (Dashboard) or **Option 3** (External service)
- Some Supabase projects don't have pg_cron enabled

### "Function not found"
- Make sure `soundtrack_job_runner` is deployed:
  ```bash
  supabase functions deploy soundtrack_job_runner
  ```

### "Unauthorized" errors
- Check that `YOUR_SERVICE_ROLE_KEY` is correct
- Make sure you're using the `service_role` key, not `anon` key

### Jobs not processing
- Check cron job is actually running (check logs)
- Verify jobs exist in `sound_track_jobs` table with `status = 'queued'`
- Check job runner logs for errors
