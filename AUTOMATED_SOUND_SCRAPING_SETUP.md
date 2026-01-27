# Automated Sound Scraping Setup

## Overview

This implements an automated sound scraping system where:
1. User submits a sound link → DTTracker automatically sends to Apify
2. Apify scrapes the data → Results come back via webhook
3. Results stored in Supabase → User sees them in the app

## Architecture

```
User submits sound link
    ↓
soundtrack_create_from_link (Edge Function)
    ↓
Creates sound_track + automatically calls soundtrack_start_scrape
    ↓
soundtrack_start_scrape (Edge Function)
    ↓
Creates job in sound_scrape_jobs + Starts Apify actor run
    ↓
Apify scrapes data (runs independently)
    ↓
Apify calls webhook when done
    ↓
soundtrack_scrape_webhook (Edge Function)
    ↓
Fetches results from Apify + Writes to Supabase
    ↓
User sees results in DTTracker app
```

## Database Setup

### Step 1: Run Migration

Run this in Supabase SQL Editor:
```sql
-- database/migrations/045_create_sound_scrape_jobs.sql
```

This creates:
- `sound_scrape_jobs` - Tracks Apify scrape jobs
- `sound_track_stats` - Summary statistics
- `sound_track_videos` - Individual videos using the sound

## Edge Functions Setup

### Step 2: Deploy Functions

```bash
# Deploy the scrape starter
supabase functions deploy soundtrack_start_scrape

# Deploy the webhook handler
supabase functions deploy soundtrack_scrape_webhook

# Update the existing function (already done)
supabase functions deploy soundtrack_create_from_link
```

### Step 3: Set Secrets

```bash
# Required secrets
supabase secrets set APIFY_API_TOKEN="apify_api_PRJ472UAbkuq4i9RyQntOzLDn9jS9a2wPaOE"
supabase secrets set APIFY_WEBHOOK_SECRET="your-random-secret-here"  # Generate a random string
supabase secrets set SB_URL="https://ucbueapoexnxhttynfzy.supabase.co"
supabase secrets set SB_SERVICE_ROLE_KEY="your-service-role-key"
```

## How It Works

### 1. User Submits Sound Link

When user creates a sound track:
- `soundtrack_create_from_link` creates the sound
- **Automatically calls** `soundtrack_start_scrape`
- Scrape job is queued immediately

### 2. Apify Scrapes

- `soundtrack_start_scrape` creates job in `sound_scrape_jobs`
- Starts Apify actor run with webhook configured
- Job status = `running`

### 3. Webhook Receives Results

- Apify calls `soundtrack_scrape_webhook` when done
- Webhook verifies secret (security)
- Fetches results from Apify dataset
- Writes to `sound_track_videos` and `sound_track_stats`
- Updates job status = `success`

### 4. User Sees Results

- UI polls job status (every 5 seconds while running)
- Shows videos table when ready
- Displays stats (total uses, avg views, etc.)

## Features

✅ **Automatic** - No manual trigger needed
✅ **Webhook-based** - No polling Apify
✅ **Deduplication** - Reuses results within 6 hours
✅ **Secure** - Webhook secret verification
✅ **Scalable** - Handles multiple concurrent scrapes
✅ **Real-time UI** - Auto-refreshes when job completes

## UI Integration

The `sound-track-detail.tsx` component now shows:
- **Job Status** - "Scraping...", "Complete", "Failed"
- **Videos Table** - Top videos using the sound
- **Stats** - Total uses, avg views, top video metrics

## Testing

1. Go to `/sounds/new`
2. Paste a TikTok music URL
3. Click "Start Tracking"
4. **Automatically:**
   - Sound is created
   - Scrape job starts
   - Apify scrapes data
   - Results appear when ready

## Troubleshooting

### Webhook not being called
- Check Apify actor run logs
- Verify webhook URL is correct
- Check `APIFY_WEBHOOK_SECRET` matches

### Job stuck in "running"
- Check Apify run status
- Verify webhook endpoint is accessible
- Check Edge Function logs

### No videos appearing
- Check `sound_track_videos` table
- Verify Apify returned data
- Check webhook logs for errors

## Next Steps

1. Run migration: `045_create_sound_scrape_jobs.sql`
2. Deploy functions: `soundtrack_start_scrape` and `soundtrack_scrape_webhook`
3. Set secrets: `APIFY_API_TOKEN` and `APIFY_WEBHOOK_SECRET`
4. Test by creating a sound track

The system is now fully automated! 🚀
