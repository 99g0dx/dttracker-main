#!/bin/bash

# Deployment script for AI Creator Scraper Edge Function
# This script deploys the extract-creator-info Edge Function to Supabase

set -e  # Exit on error

echo "🚀 AI Creator Scraper - Edge Function Deployment"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "📦 Install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Project not linked to Supabase"
    echo ""
    echo "To link your project:"
    echo "  1. Go to https://app.supabase.com"
    echo "  2. Find your project reference ID (Settings -> General)"
    echo "  3. Run: supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    read -p "Have you linked your project? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please link your project first and run this script again."
        exit 1
    fi
fi

# Check if OPENAI_API_KEY is set in Supabase
echo "🔑 Checking for OpenAI API key..."
echo ""
echo "⚠️  Important: Make sure you've set OPENAI_API_KEY in Supabase Edge Functions"
echo ""
echo "To set it:"
echo "  Option 1 (Dashboard):"
echo "    1. Go to https://app.supabase.com"
echo "    2. Navigate to Edge Functions -> Settings"
echo "    3. Add environment variable: OPENAI_API_KEY"
echo ""
echo "  Option 2 (CLI):"
echo "    supabase secrets set OPENAI_API_KEY=sk-your-key-here"
echo ""
read -p "Have you set the OPENAI_API_KEY? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set the API key first and run this script again."
    exit 1
fi

# Deploy the Edge Function
echo ""
echo "📤 Deploying extract-creator-info Edge Function..."
echo ""

supabase functions deploy extract-creator-info --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Edge Function deployed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test the feature in your app: Creators -> Add Creator -> Creator Scraper"
    echo "  2. Upload a social media profile screenshot"
    echo "  3. Click 'Extract Creator Info'"
    echo ""
    echo "📊 Monitor usage:"
    echo "  - View logs: https://app.supabase.com -> Edge Functions -> extract-creator-info -> Logs"
    echo "  - OpenAI usage: https://platform.openai.com/usage"
    echo ""
    echo "💡 Tip: Each extraction costs $0.01-0.03 depending on image detail level"
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    echo ""
    echo "Common issues:"
    echo "  - Not logged in: Run 'supabase login'"
    echo "  - Project not linked: Run 'supabase link --project-ref YOUR_REF'"
    echo "  - Syntax errors: Check supabase/functions/extract-creator-info/index.ts"
    exit 1
fi
