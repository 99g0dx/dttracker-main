#!/bin/bash

# Script to verify soundtrack_create_from_link function is deployed

echo "🔍 Verifying soundtrack_create_from_link function deployment..."
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase CLI"
    echo "Run: supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase CLI"
echo ""

# List functions
echo "📋 Checking deployed functions..."
supabase functions list

echo ""
echo "🔍 Looking for soundtrack_create_from_link..."
if supabase functions list | grep -q "soundtrack_create_from_link"; then
    echo "✅ Function is deployed!"
else
    echo "❌ Function NOT found in deployed functions"
    echo ""
    echo "Deploy it with:"
    echo "  supabase functions deploy soundtrack_create_from_link"
fi

echo ""
echo "📝 To check function logs:"
echo "  1. Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions"
echo "  2. Click on 'soundtrack_create_from_link'"
echo "  3. Go to 'Logs' tab"
echo "  4. Try creating a sound track and watch for logs"
