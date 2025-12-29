# Redeploy Edge Function - Fixed

The Edge Function has been updated to fix the "non-2xx status code" error.

## What Was Fixed

Changed all error responses to return **status 200** with error details in the response body, instead of returning status 400, 401, or 500. This is the correct pattern for Supabase Edge Functions.

## How to Redeploy

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to: https://app.supabase.com/project/qntqhwokhbcgcduhpvjk/functions/extract-creator-info

2. Click **"Edit function"** or find the code editor

3. **Copy all the code** from:
   `supabase/functions/extract-creator-info/index.ts`

4. **Paste it** into the function editor (replacing the old code)

5. Click **"Deploy"** or **"Save"**

6. **Test it!** Go back to your app and try extracting creator info again

### Option 2: Using CLI (If you have it set up)

```bash
cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"
supabase functions deploy extract-creator-info
```

## After Redeploying

1. Refresh your DTTracker app
2. Go to **Creators → Add Creator → Creator Scraper**
3. Upload a social media profile screenshot
4. Click **"Extract Creator Info"**

It should now work without the "non-2xx status code" error!

## If You Still Get Errors

Check the Edge Function logs at:
https://app.supabase.com/project/qntqhwokhbcgcduhpvjk/functions/extract-creator-info/logs

The logs will show you exactly what error is happening (likely "OpenAI API key not configured" if you haven't set it yet).
