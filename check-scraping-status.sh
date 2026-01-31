#!/bin/bash

# Script to check scraping status using Supabase CLI
# This checks if scraping is working without needing SQL Editor

echo "🔍 Checking Sound Scraping Status..."
echo ""

# Check if functions are deployed
echo "📦 Checking deployed functions..."
FUNCTIONS=$(supabase functions list 2>/dev/null)

if echo "$FUNCTIONS" | grep -q "soundtrack_start_scrape"; then
  echo "✅ soundtrack_start_scrape is deployed"
else
  echo "❌ soundtrack_start_scrape is NOT deployed"
  echo "   Run: supabase functions deploy soundtrack_start_scrape"
fi

if echo "$FUNCTIONS" | grep -q "soundtrack_scrape_webhook"; then
  echo "✅ soundtrack_scrape_webhook is deployed"
else
  echo "❌ soundtrack_scrape_webhook is NOT deployed"
  echo "   Run: supabase functions deploy soundtrack_scrape_webhook"
fi

if echo "$FUNCTIONS" | grep -q "soundtrack_job_runner"; then
  echo "✅ soundtrack_job_runner is deployed"
else
  echo "❌ soundtrack_job_runner is NOT deployed"
  echo "   Run: supabase functions deploy soundtrack_job_runner"
fi

echo ""

# Check if Apify token is set
echo "🔑 Checking Apify configuration..."
SECRETS=$(supabase secrets list 2>/dev/null)

if echo "$SECRETS" | grep -q "APIFY_API_TOKEN"; then
  echo "✅ APIFY_API_TOKEN is set"
else
  echo "❌ APIFY_API_TOKEN is NOT set"
  echo "   Run: supabase secrets set APIFY_API_TOKEN=your_token"
fi

if echo "$SECRETS" | grep -q "APIFY_WEBHOOK_SECRET"; then
  echo "✅ APIFY_WEBHOOK_SECRET is set"
else
  echo "⚠️  APIFY_WEBHOOK_SECRET is not set (optional, but recommended)"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Check Edge Function logs in Supabase Dashboard:"
echo "   - Go to: Edge Functions → soundtrack_create_from_link → Logs"
echo "   - Look for: '✅ Scrape job started' or '❌ Failed to start scrape job'"
echo ""
echo "2. Check scrape jobs in Supabase SQL Editor:"
echo "   - Go to: SQL Editor → New Query"
echo "   - Run: SELECT * FROM sound_scrape_jobs ORDER BY created_at DESC LIMIT 5;"
echo "   - Run: SELECT * FROM sound_track_jobs WHERE status = 'queued' LIMIT 10;"
echo ""
echo "3. Check Apify dashboard:"
echo "   - Go to: https://console.apify.com/actors/runs"
echo "   - Look for runs of 'apidojo/tiktok-music-scraper'"
echo ""
echo "4. Set up cron job (if not done):"
echo "   - Run: database/setup_soundtrack_cron_simple.sql in SQL Editor"
echo "   - Or use Supabase Dashboard → Database → Cron Jobs"
