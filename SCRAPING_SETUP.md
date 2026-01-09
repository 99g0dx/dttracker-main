# Scraping Setup Guide

This guide explains how to set up the social media scraping functionality for DTTracker.

## Overview

The scraping system uses:
- **RapidAPI** for TikTok & Instagram (affordable, reliable)
- **YouTube Data API v3** for YouTube (free, official Google API)
- **Mock data** for Twitter & Facebook (until implemented)

## Cost Estimate

### Development (Testing)
- **RapidAPI Free Tier**: 50-100 requests/month = $0/month
- **YouTube API**: 10,000 requests/day = $0/month
- **Total**: $0/month

### Production (Launch)
- **RapidAPI Basic**: $10-20/month for ~1,000-5,000 requests
- **YouTube API**: Free up to 10k/day
- **Total**: ~$10-20/month for initial launch

---

## Step 1: Get RapidAPI Key (TikTok & Instagram)

### 1.1 Create RapidAPI Account
1. Go to https://rapidapi.com/
2. Click "Sign Up" (free account)
3. Verify your email

### 1.2 Subscribe to TikTok API
1. Go to https://rapidapi.com/yi005/api/tiktok-video-no-watermark2
2. Click "Subscribe to Test"
3. Select **Basic Plan** ($0/month for 50 requests)
4. Click "Subscribe"

### 1.3 Subscribe to Instagram API
1. Go to https://rapidapi.com/rapihub-rapihub-default/api/instagram-scraper-api2
2. Click "Subscribe to Test"
3. Select **Basic Plan** ($0/month for 50 requests)
4. Click "Subscribe"

### 1.4 Get Your API Key
1. Go to https://rapidapi.com/developer/security
2. Copy your **X-RapidAPI-Key** (starts with something like `abc123...`)
3. Save this key - you'll need it for Supabase

---

## Step 2: Get YouTube API Key (Optional but Recommended)

### 2.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Enter project name: `DTTracker` → Create

### 2.2 Enable YouTube Data API v3
1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "YouTube Data API v3"
3. Click on it → Click "Enable"

### 2.3 Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "API Key"
3. Copy the API key (starts with `AIza...`)
4. (Optional) Click "Restrict Key" to limit to YouTube Data API v3

### 2.4 Free Quota
- **10,000 requests per day** (free)
- **Cost**: $0 unless you exceed quota (very unlikely)

---

## Step 3: Deploy Edge Function to Supabase

### 3.1 Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop install supabase

# Or use NPM (all platforms)
npm install -g supabase
```

### 3.2 Login to Supabase
```bash
supabase login
```

This will open your browser for authentication.

### 3.3 Link to Your Project
```bash
cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"
supabase link --project-ref your-project-ref
```

**How to find your project ref:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. The URL will be: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`
4. Copy the `YOUR-PROJECT-REF` part

### 3.4 Set Environment Variables (Secrets)
```bash
# Set RapidAPI Key
supabase secrets set RAPIDAPI_KEY=your_rapidapi_key_here

# Set YouTube API Key (optional)
supabase secrets set YOUTUBE_API_KEY=your_youtube_key_here
```

**Replace** `your_rapidapi_key_here` and `your_youtube_key_here` with your actual keys from Steps 1 and 2.

### 3.5 Deploy the Edge Function
```bash
supabase functions deploy scrape-post
```

You should see:
```
Deploying Function scrape-post (project ref: xxx)
✓ Function deployed successfully
Function URL: https://xxx.supabase.co/functions/v1/scrape-post
```

---

## Step 4: Test the Scraping

### 4.1 Test in Your App
1. Create a campaign
2. Add a post with a TikTok or Instagram URL
3. Click "Scrape All Posts"
4. Check the post metrics update

### 4.2 Test with Mock Data (No API Keys)
If you **don't** set `RAPIDAPI_KEY` or `YOUTUBE_API_KEY`, the Edge Function will return **realistic mock data** for testing. This is perfect for development!

**Mock data ranges:**
- TikTok: 10k-100k views, 1k-10k likes
- Instagram: 5k-50k views, 500-5k likes
- YouTube: 50k-500k views, 2k-20k likes

### 4.3 Check Logs
```bash
# View Edge Function logs
supabase functions logs scrape-post
```

---

## Step 5: Monitor Usage & Costs

### RapidAPI Dashboard
1. Go to https://rapidapi.com/developer/billing
2. View your usage for TikTok & Instagram APIs
3. Upgrade plan if needed

### YouTube API Dashboard
1. Go to https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. View your daily quota usage
3. Should stay well under 10,000/day limit

---

## Pricing Breakdown

### RapidAPI Plans (per API)

**TikTok Video No Watermark API:**
- **Basic**: $0/month - 50 requests
- **Pro**: $10/month - 1,000 requests
- **Ultra**: $30/month - 10,000 requests

**Instagram Scraper API:**
- **Basic**: $0/month - 50 requests
- **Pro**: $15/month - 1,000 requests
- **Ultra**: $50/month - 10,000 requests

### Recommended for Launch
- Start with **free tier** for both (100 requests total)
- Upgrade to **Pro** when you hit limits (~$25/month for both)
- At 10k+ requests/month, consider enterprise solutions

---

## Troubleshooting

### Error: "RAPIDAPI_KEY not configured"
**Solution**: Set the secret in Supabase:
```bash
supabase secrets set RAPIDAPI_KEY=your_key_here
```

### Error: "TikTok API error: 429"
**Cause**: Rate limit exceeded
**Solution**:
1. Check RapidAPI dashboard for usage
2. Upgrade to higher plan
3. Or wait until quota resets

### Error: "Failed to scrape Instagram"
**Possible causes:**
1. Invalid Instagram URL
2. Private account (can't scrape)
3. API rate limit hit

**Solution**: Check Edge Function logs:
```bash
supabase functions logs scrape-post --limit 50
```

### YouTube API Error: "quotaExceeded"
**Cause**: Exceeded 10k requests/day (rare)
**Solution**: Wait until midnight PST for quota reset

---

## Alternative: Use Mock Data Only

If you want to **skip API setup entirely** for now:

1. **Don't set any environment variables**
2. The Edge Function will automatically use mock data
3. Perfect for:
   - Development
   - Testing the UI
   - Demos/screenshots
   - MVP validation

You can add real API keys later when you're ready to launch!

---

## Next Steps

After scraping is working:

1. **Test CSV Import/Export** - Import a CSV with post URLs, then scrape them
2. **Check Historical Metrics** - View the time-series charts
3. **Add More Posts** - Test with different platforms
4. **Monitor Costs** - Keep an eye on RapidAPI usage

---

## Support

If you run into issues:

1. **Check Edge Function Logs**: `supabase functions logs scrape-post`
2. **Verify API Keys**: Make sure they're set correctly in Supabase secrets
3. **Test API Keys**: Try them directly in RapidAPI dashboard
4. **Check RapidAPI Status**: https://rapidapi.com/status

---

## Summary

**Quickest Setup (Development):**
```bash
# 1. Deploy without API keys (uses mock data)
supabase functions deploy scrape-post

# Done! Mock data will be returned for all scrapes
```

**Production Setup:**
```bash
# 1. Get RapidAPI key from rapidapi.com (free)
# 2. Get YouTube API key from console.cloud.google.com (free)
# 3. Set secrets
supabase secrets set RAPIDAPI_KEY=your_key
supabase secrets set YOUTUBE_API_KEY=your_key
# 4. Deploy
supabase functions deploy scrape-post

# Done! Real scraping is live
```

**Cost**: $0-10/month for launch, $20-50/month at scale.
