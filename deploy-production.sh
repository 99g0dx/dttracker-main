#!/bin/bash

# DTTracker Production Deployment Script
# This script deploys your app with all API keys configured

set -e  # Exit on error

echo "🚀 DTTracker Production Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Keys (pre-configured)
RAPIDAPI_KEY="ca953321a4msh6c804295f3b39e4p16e53fjsn74acdf55b219"
YOUTUBE_API_KEY="AIzaSyC7B0ziLYmma313p2FoIXW8BcbfIcPg7Io"

echo -e "${BLUE}📋 Pre-configured API Keys:${NC}"
echo "  ✅ RapidAPI Key (TikTok & Instagram)"
echo "  ✅ YouTube Data API Key"
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found ($(supabase --version))${NC}"
echo ""

# Step 1: Login
echo -e "${BLUE}Step 1: Login to Supabase${NC}"
echo "------------------------"
echo "This will open your browser for authentication..."
read -p "Press Enter to continue..."

if supabase login; then
    echo -e "${GREEN}✓ Successfully logged in${NC}"
else
    echo -e "${RED}❌ Login failed${NC}"
    exit 1
fi
echo ""

# Step 2: Link Project
echo -e "${BLUE}Step 2: Link to Supabase Project${NC}"
echo "--------------------------------"
echo ""
echo "📍 How to find your Project Reference ID:"
echo "  1. Go to https://supabase.com/dashboard"
echo "  2. Select your project"
echo "  3. Copy the ID from the URL: https://supabase.com/dashboard/project/YOUR-PROJECT-REF"
echo ""
read -p "Enter your Supabase project reference ID: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference cannot be empty${NC}"
    exit 1
fi

echo ""
echo "🔗 Linking to project: $PROJECT_REF"
echo "You'll be asked to enter your database password..."
echo ""

if supabase link --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✓ Successfully linked to project${NC}"
else
    echo -e "${RED}❌ Failed to link to project${NC}"
    exit 1
fi
echo ""

# Step 3: Configure Secrets
echo -e "${BLUE}Step 3: Configure API Keys (Secrets)${NC}"
echo "------------------------------------"
echo ""

echo "🔐 Setting RapidAPI key..."
if supabase secrets set RAPIDAPI_KEY="$RAPIDAPI_KEY" --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✓ RapidAPI key configured${NC}"
else
    echo -e "${YELLOW}⚠ Failed to set RapidAPI key${NC}"
    echo "You may need to set it manually with:"
    echo "  supabase secrets set RAPIDAPI_KEY=$RAPIDAPI_KEY"
fi

echo ""
echo "🔐 Setting YouTube API key..."
if supabase secrets set YOUTUBE_API_KEY="$YOUTUBE_API_KEY" --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✓ YouTube API key configured${NC}"
else
    echo -e "${YELLOW}⚠ Failed to set YouTube API key${NC}"
    echo "You may need to set it manually with:"
    echo "  supabase secrets set YOUTUBE_API_KEY=$YOUTUBE_API_KEY"
fi

echo ""

# Step 4: Verify Secrets
echo -e "${BLUE}Step 4: Verify Secrets${NC}"
echo "---------------------"
echo ""
echo "📋 Configured secrets:"
supabase secrets list --project-ref "$PROJECT_REF" || echo -e "${YELLOW}⚠ Could not list secrets${NC}"
echo ""

# Step 5: Deploy Edge Function
echo -e "${BLUE}Step 5: Deploy Edge Function${NC}"
echo "---------------------------"
echo ""
echo "This will deploy the 'scrape-post' Edge Function with:"
echo "  - TikTok scraping (RapidAPI)"
echo "  - Instagram scraping (RapidAPI)"
echo "  - YouTube scraping (YouTube Data API v3)"
echo ""
read -p "Ready to deploy? (y/n): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" = "y" ] || [ "$DEPLOY_CONFIRM" = "Y" ]; then
    echo ""
    echo "📦 Deploying Edge Function..."
    if supabase functions deploy scrape-post --no-verify-jwt --project-ref "$PROJECT_REF"; then
        echo ""
        echo -e "${GREEN}✓ Edge Function deployed successfully!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Failed to deploy Edge Function${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Skipping Edge Function deployment${NC}"
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}📊 What's Configured:${NC}"
echo "  ✅ RapidAPI key (TikTok & Instagram)"
echo "  ✅ YouTube Data API key"
echo "  ✅ Edge Function deployed"
echo ""
echo -e "${BLUE}🧪 Next Steps:${NC}"
echo ""
echo "1. Test the Edge Function:"
echo "   supabase functions logs scrape-post --limit 20"
echo ""
echo "2. Configure frontend environment variables (.env.local):"
echo "   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co"
echo "   VITE_SUPABASE_ANON_KEY=your_anon_key"
echo ""
echo "3. Test scraping with real posts in your app"
echo ""
echo "4. Monitor API usage:"
echo "   - RapidAPI: https://rapidapi.com/developer/billing"
echo "   - YouTube: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "  - Quick Start: QUICK_START.md"
echo "  - Full Guide: PRODUCTION_DEPLOYMENT.md"
echo "  - Checklist: PRODUCTION_CHECKLIST.md"
echo ""
