#!/bin/bash
# Script to apply migrations and deploy Edge Functions with debug logging

set -e

echo "🔧 Applying database migrations with debug logging..."
supabase db push

echo ""
echo "🚀 Deploying scrape-post Edge Function..."
supabase functions deploy scrape-post

echo ""
echo "🚀 Deploying scrape-all-posts Edge Function..."
supabase functions deploy scrape-all-posts

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Clear browser cache or hard refresh (Cmd+Shift+R / Ctrl+Shift+R)"
echo "2. Trigger a scrape that should work for an agency account"
echo "3. Check logs:"
echo "   - Client logs: .cursor/debug.log"
echo "   - Edge Function logs: Supabase Dashboard → Edge Functions → Logs"
