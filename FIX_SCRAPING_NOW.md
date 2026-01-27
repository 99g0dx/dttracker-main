# Fix Scraping Issues - Step by Step

## ✅ Issues Found:
1. ❌ `soundtrack_start_scrape` function NOT deployed
2. ❌ `soundtrack_scrape_webhook` function NOT deployed  
3. ❌ `APIFY_API_TOKEN` secret NOT set

## 🔧 Fix Steps:

### Step 1: Login to Supabase
```bash
supabase login
```
Follow the prompts to authenticate.

### Step 2: Deploy Missing Functions

```bash
# Deploy the function that starts scraping
supabase functions deploy soundtrack_start_scrape

# Deploy the webhook that receives Apify results
supabase functions deploy soundtrack_scrape_webhook
```

### Step 3: Set Apify Token

You need your Apify API token. Get it from:
- https://console.apify.com/account/integrations
- Click "API tokens" → Copy your token

Then set it:
```bash
supabase secrets set APIFY_API_TOKEN=your_apify_token_here
```

Replace `your_apify_token_here` with your actual Apify token.

### Step 4: (Optional) Set Webhook Secret

```bash
supabase secrets set APIFY_WEBHOOK_SECRET=your_secret_here
```

You can use any random string, or use part of your service role key.

### Step 5: Verify Everything is Set

Run the check script again:
```bash
./check-scraping-status.sh
```

You should see all ✅ green checkmarks.

### Step 6: Test Scraping

1. Create a new sound in the app
2. Check Edge Function logs:
   - Supabase Dashboard → Edge Functions → `soundtrack_create_from_link` → Logs
   - Look for: `✅ Scrape job started successfully`
3. Check Apify dashboard:
   - https://console.apify.com/actors/runs
   - You should see a new run for `apidojo/tiktok-music-scraper`

## 🎯 Quick Command Summary

```bash
# 1. Login
supabase login

# 2. Deploy functions
supabase functions deploy soundtrack_start_scrape
supabase functions deploy soundtrack_scrape_webhook

# 3. Set Apify token (replace with your actual token)
supabase secrets set APIFY_API_TOKEN=your_token_here

# 4. Verify
./check-scraping-status.sh
```

## 📝 After Fixing

Once you've deployed the functions and set the token:
- Scraping will automatically start when you create a new sound
- You'll see a blue banner on the sound detail page showing "Scraping in progress..."
- Results will appear automatically when Apify finishes (usually 5-10 minutes)
