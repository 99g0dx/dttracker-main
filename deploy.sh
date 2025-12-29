#!/bin/bash

# DTTracker Production Deployment Script
# This script will help you deploy DTTracker to production

set -e  # Exit on error

echo "🚀 DTTracker Production Deployment"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found ($(supabase --version))${NC}"
echo ""

# Step 1: Login to Supabase
echo "Step 1: Login to Supabase"
echo "------------------------"
echo "This will open your browser for authentication..."
read -p "Press Enter to continue..."

if supabase login; then
    echo -e "${GREEN}✓ Successfully logged in to Supabase${NC}"
else
    echo -e "${RED}❌ Login failed${NC}"
    exit 1
fi
echo ""

# Step 2: Get Project Reference
echo "Step 2: Link to Supabase Project"
echo "--------------------------------"
echo "Go to https://supabase.com/dashboard and find your project."
echo "The project reference is in the URL: https://supabase.com/dashboard/project/YOUR-PROJECT-REF"
echo ""
read -p "Enter your Supabase project reference ID: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference cannot be empty${NC}"
    exit 1
fi

echo ""
echo "Linking to project: $PROJECT_REF"
echo "You'll be asked to enter your database password..."

if supabase link --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✓ Successfully linked to project${NC}"
else
    echo -e "${RED}❌ Failed to link to project${NC}"
    exit 1
fi
echo ""

# Step 3: Set API Keys
echo "Step 3: Configure API Keys"
echo "-------------------------"

# RapidAPI Key
RAPIDAPI_KEY="ca953321a4msh6c804295f3b39e4p16e53fjsn74acdf55b219"
echo "Setting RapidAPI key..."
if supabase secrets set RAPIDAPI_KEY="$RAPIDAPI_KEY" --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✓ RapidAPI key configured${NC}"
else
    echo -e "${YELLOW}⚠ Failed to set RapidAPI key (you may need to set it manually)${NC}"
fi

# YouTube API Key (optional)
echo ""
read -p "Do you have a YouTube API key? (y/n): " HAS_YOUTUBE_KEY

if [ "$HAS_YOUTUBE_KEY" = "y" ] || [ "$HAS_YOUTUBE_KEY" = "Y" ]; then
    read -p "Enter your YouTube API key: " YOUTUBE_KEY
    if [ -n "$YOUTUBE_KEY" ]; then
        if supabase secrets set YOUTUBE_API_KEY="$YOUTUBE_KEY" --project-ref "$PROJECT_REF"; then
            echo -e "${GREEN}✓ YouTube API key configured${NC}"
        else
            echo -e "${YELLOW}⚠ Failed to set YouTube API key${NC}"
        fi
    fi
else
    echo -e "${YELLOW}ℹ Skipping YouTube API key (YouTube scraping will use mock data)${NC}"
fi

echo ""

# Step 4: Verify secrets
echo "Step 4: Verify Secrets"
echo "---------------------"
echo "Checking configured secrets..."
supabase secrets list --project-ref "$PROJECT_REF" || true
echo ""

# Step 5: Deploy Edge Function
echo "Step 5: Deploy Edge Function"
echo "---------------------------"
read -p "Ready to deploy the scrape-post Edge Function? (y/n): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" = "y" ] || [ "$DEPLOY_CONFIRM" = "Y" ]; then
    echo "Deploying Edge Function..."
    if supabase functions deploy scrape-post --no-verify-jwt --project-ref "$PROJECT_REF"; then
        echo -e "${GREEN}✓ Edge Function deployed successfully${NC}"
    else
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
echo "Next steps:"
echo "1. Configure your frontend environment variables (.env.local)"
echo "2. Test the Edge Function with a sample post"
echo "3. Deploy your frontend to Vercel/Netlify"
echo ""
echo "For detailed instructions, see:"
echo "  - PRODUCTION_DEPLOYMENT.md"
echo "  - PRODUCTION_CHECKLIST.md"
echo ""
