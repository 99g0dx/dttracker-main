# Check Scraper Logs to Debug Issues

I've added comprehensive logging to the Edge Function. Follow these steps to see what's happening:

## Step 1: Check Edge Function Logs

1. **Go to Supabase Dashboard**
2. **Navigate to Edge Functions** → **Logs**
3. **Select `scrape-post` function**
4. **Try scraping a post** (click the refresh icon on a post)
5. **Check the logs immediately** - you should see detailed information

## What to Look For in Logs

The logs will show you exactly where it's failing:

### ✅ If you see "=== Scrape Request Received ==="
- The function is being called correctly
- Check the next log entries

### ✅ If you see "Environment check:"
- Shows if secrets are being read
- `hasUrl: true` and `hasKey: true` = secrets are set
- `hasUrl: false` or `hasKey: false` = secrets are missing

### ✅ If you see "Authenticated user: [user-id]"
- Authentication is working
- The function can verify your login

### ✅ If you see "Starting scrape for [platform] post: [url]"
- The request is valid
- It's about to call the scraping API

### ❌ If you see errors:
- **"Missing Supabase credentials"** → Secrets not set correctly
- **"Authentication failed"** → Auth token issue
- **"Scraping failed"** → API error (check which platform)
- **"Database update error"** → Database permission issue

## Step 2: Check Browser Console

1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Try scraping a post**
4. **Look for error messages**

## Step 3: Common Issues & Solutions

### Issue: "Missing Supabase credentials" in logs
**Solution:**
- Go to **Edge Functions** → **Settings** → **Secrets**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist
- Make sure names match exactly (case-sensitive)

### Issue: "Authentication failed" in logs
**Solution:**
- Try logging out and back in
- Check that your session is valid
- Verify the auth token is being sent

### Issue: "Scraping failed: [error]" in logs
**Solution:**
- Check which platform failed
- If TikTok/Instagram: Check if `RAPIDAPI_KEY` is set
- If YouTube: Check if `YOUTUBE_API_KEY` is set
- Without API keys, it should return mock data (but might still fail)

### Issue: "Database update error" in logs
**Solution:**
- Check RLS policies on `posts` table
- Verify the service role key has proper permissions
- Check if the post exists in the database

## Step 4: Share the Logs

If it's still not working, please share:
1. **The error message from the logs** (copy/paste)
2. **What you see in the browser console** (F12 → Console)
3. **The toast notification error message**

This will help identify the exact issue.

