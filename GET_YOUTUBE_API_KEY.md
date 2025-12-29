# How to Get YouTube Data API Key

You've shared a Google OAuth Client Secret, but we need a YouTube Data API Key instead.

## Quick Steps (2 minutes)

### 1. Go to Google Cloud Console
https://console.cloud.google.com/apis/credentials

### 2. Select Your Project
- If you already have a project, select it from the dropdown
- If not, click "Create Project" and name it "DTTracker"

### 3. Create API Key

1. Click **"+ CREATE CREDENTIALS"** button at the top
2. Select **"API Key"** from the dropdown
3. A popup will appear with your new API key
4. **COPY THIS KEY** - it starts with `AIza...`
5. Click **"RESTRICT KEY"** (important for security)

### 4. Restrict the API Key

In the API Key configuration page:

**Application restrictions:**
- Select **"HTTP referrers (websites)"**
- Click **"ADD AN ITEM"**
- Add these referrers:
  ```
  https://*.supabase.co/*
  https://yourdomain.com/*
  ```

**API restrictions:**
- Select **"Restrict key"**
- Click **"Select APIs"** dropdown
- Search for and select **"YouTube Data API v3"**
- Click **"Save"**

### 5. Enable YouTube Data API v3

1. Go to **APIs & Services** → **Library**
2. Search for **"YouTube Data API v3"**
3. Click on it
4. Click **"ENABLE"** button

---

## Your API Key

Once you have the API key (starts with `AIza...`), share it with me and I'll configure it in your Supabase project.

**Example format:**
```
AIzaSyD1234567890abcdefghijklmnopqrstuvwxyz
```

---

## What You Have vs What We Need

❌ **What you shared** (OAuth Client Secret):
```
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
```
- This is for OAuth authentication (login with Google)
- Not used for YouTube scraping

✅ **What we need** (YouTube Data API Key):
```
AIzaSy... (your actual key)
```
- This is for accessing YouTube Data API v3
- Used to fetch video statistics (views, likes, comments)

---

## Alternative: Skip YouTube for Now

If you want to deploy without YouTube scraping right now:
- YouTube scraping will use **mock data** instead
- You can add the API key later
- TikTok and Instagram will still work with your RapidAPI key

To proceed without YouTube:
1. Just deploy with your RapidAPI key
2. YouTube posts will show realistic mock data
3. Add YouTube API key later when ready

---

## Free Quota

YouTube Data API v3 is **free** with generous limits:
- **10,000 requests per day**
- Quota resets at midnight Pacific Time
- More than enough for most use cases

---

Let me know when you have the YouTube API key, or if you want to proceed without it for now!
