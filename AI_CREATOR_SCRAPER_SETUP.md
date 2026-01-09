# AI Creator Scraper Setup Guide

This guide will help you set up the AI-powered creator information extraction feature.

## Overview

The Creator Scraper uses OpenAI's GPT-4 Vision API to automatically extract creator information (handle, followers, contact info, etc.) from social media profile screenshots.

## Prerequisites

1. A Supabase project (already set up)
2. An OpenAI API account with access to GPT-4 Vision
3. Supabase CLI installed (for deploying Edge Functions)

## Step 1: Get OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **"Create new secret key"**
4. Name it something like "DTTracker Creator Scraper"
5. Copy the API key (starts with `sk-`)
6. **Important:** Save this key securely - you won't be able to see it again

## Step 2: Add API Key to Supabase Edge Functions

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard at [https://app.supabase.com](https://app.supabase.com)
2. Navigate to **Edge Functions** in the left sidebar
3. Click on **Settings** or **Environment Variables**
4. Add a new environment variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (e.g., `sk-proj-...`)
5. Click **Save**

### Option B: Using Supabase CLI

```bash
# Set the environment variable for all Edge Functions
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Step 3: Deploy the Edge Function

Make sure you have Supabase CLI installed and linked to your project:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project (one-time setup)
supabase link --project-ref your-project-ref

# Deploy the extract-creator-info Edge Function
supabase functions deploy extract-creator-info
```

## Step 4: Verify Deployment

1. Go to **Edge Functions** in your Supabase dashboard
2. You should see `extract-creator-info` listed
3. Check the **Logs** tab to ensure there are no deployment errors

## Step 5: Test the Feature

1. Open your DTTracker application
2. Navigate to **Creators** → **Add Creator** → **Creator Scraper**
3. Upload a screenshot of a social media profile (Instagram, TikTok, YouTube, etc.)
4. Click **"Extract Creator Info"**
5. The AI should extract:
   - Username/Handle
   - Follower count
   - Contact information (if visible)
   - Platform detection
   - Location (if visible)
   - Content niche/category

## Cost Considerations

**OpenAI GPT-4 Vision Pricing:**
- High detail: ~$0.03 per image
- Low detail: ~$0.01 per image

**Estimated Monthly Costs:**
- 100 extractions/month: $1-3
- 500 extractions/month: $5-15
- 1000 extractions/month: $10-30

## Troubleshooting

### Issue: "OpenAI API key not configured"

**Solution:** Make sure you've added the `OPENAI_API_KEY` environment variable in Supabase Edge Functions settings.

### Issue: "Extraction failed" or low confidence scores

**Possible causes:**
- Screenshot is blurry or low quality
- Text is too small to read
- Screenshot shows multiple profiles (use a single profile screenshot)
- Profile is in an unsupported language

**Solutions:**
- Use high-resolution screenshots
- Ensure the profile information is clearly visible
- Crop the screenshot to show only one profile
- You can always manually edit the extracted information

### Issue: Rate limit errors

**Solution:** The Edge Function implements automatic retry logic with exponential backoff. If you're hitting rate limits frequently, consider:
- Spacing out extraction requests
- Upgrading your OpenAI API tier

### Issue: Edge Function deployment fails

**Common causes:**
- Not linked to Supabase project: Run `supabase link --project-ref your-ref`
- CLI not authenticated: Run `supabase login`
- Function code has syntax errors: Check the deployment logs

## Feature Details

### Extraction Process

1. User uploads a screenshot
2. Image is validated (size, format)
3. Image data is sent to Edge Function
4. Edge Function calls GPT-4 Vision API with structured prompt
5. AI analyzes the image and extracts information
6. Confidence scores are calculated for each field
7. Results are returned to the frontend
8. User can review and edit extracted information

### Supported Platforms

- TikTok
- Instagram
- YouTube
- Twitter/X
- Facebook

### Extracted Fields

- **Handle/Username** (required) - with @ symbol
- **Followers/Subscribers** (required) - in K/M format
- **Contact Info** (optional) - email or website
- **Platform** (optional) - auto-detected
- **Location** (optional) - from bio
- **Niche/Category** (optional) - content type

### Confidence Scores

Each extracted field includes a confidence score (0-1):
- **High** (0.8-1.0): Green - Very confident
- **Medium** (0.6-0.8): Yellow - Moderately confident
- **Low** (0-0.6): Red - Low confidence, review carefully

## Security Notes

- The OpenAI API key is stored securely in Supabase Edge Functions (server-side)
- It is NEVER exposed to the frontend or client-side code
- All extraction requests are authenticated via Supabase auth tokens
- Only authenticated users can use the extraction feature

## Need Help?

If you encounter issues not covered here:
1. Check the Edge Function logs in Supabase Dashboard
2. Check the browser console for client-side errors
3. Verify your OpenAI API key is valid and has sufficient credits
