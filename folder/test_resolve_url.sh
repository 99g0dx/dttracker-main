#!/bin/bash

# Test script for the resolve_url Supabase Edge Function

# --- Configuration ---
# ⚠️ Replace this with your actual Supabase anon key
# You can find it in your Supabase Dashboard -> Settings -> API
SUPABASE_URL="https://ucbueapoexnxhttynfzy.supabase.co"
ANON_KEY="sb_publishable_5QcjtjsYv-hKcrq-y4_TQw_pWyuWjhH" # Replace with your Supabase Anon Key

# A sample shortened TikTok URL to test with
SHORT_URL="https://vm.tiktok.com/ZNRBBHXXW/"

# --- Do not edit below this line ---

set -e

echo "🚀 Testing resolve_url Edge Function..."
echo "======================================="
echo "Project URL: $SUPABASE_URL"
echo "Input URL:   $SHORT_URL"
echo ""

if [ "$ANON_KEY" == "YOUR_ANON_KEY" ]; then
    echo "❌ Error: Please replace 'YOUR_ANON_KEY' with your actual Supabase anon key in this script."
    exit 1
fi

FUNCTION_URL="$SUPABASE_URL/functions/v1/resolve_url"

echo "Sending request to: $FUNCTION_URL"
echo "---------------------------------------"

# Use jq to format the output if it's installed
if command -v jq &> /dev/null; then
    curl -s -X POST "$FUNCTION_URL" -H "Content-Type: application/json" -H "Authorization: Bearer $ANON_KEY" -H "apikey: $ANON_KEY" -d "{\"url\": \"$SHORT_URL\"}" | jq .
else
    echo "ℹ️ 'jq' is not installed. Output will not be pretty-printed. (brew install jq)"
    curl -s -X POST "$FUNCTION_URL" -H "Content-Type: application/json" -H "Authorization: Bearer $ANON_KEY" -H "apikey: $ANON_KEY" -d "{\"url\": \"$SHORT_URL\"}"
fi

echo ""
echo "✅ Test complete."