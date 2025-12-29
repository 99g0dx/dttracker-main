# Quick Fix: Scraper Not Working

## The Problem

The Edge Function was looking for secrets named `SB_URL` and `SB_SERVICE_ROLE_KEY`, but you set them as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## The Fix

I've updated the Edge Function code to use the correct secret names that match what you set.

## Next Steps

**You need to redeploy the Edge Function** with the updated code:

### Option 1: Using Supabase Dashboard
1. Go to **Edge Functions** → Click on `scrape-post`
2. Copy the updated code from `supabase/functions/scrape-post/index.ts`
3. Paste it into the editor
4. Click **"Deploy"** or **"Update"**

### Option 2: Using Supabase CLI
```bash
supabase functions deploy scrape-post
```

## Verify Secrets Are Set

Make sure these secrets exist in **Edge Functions** → **Settings** → **Secrets**:
- ✅ `SUPABASE_URL` = `https://ucbueapoexnxhttynfzy.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)

## After Redeploying

1. Try scraping a post again
2. It should work now!

## If It Still Doesn't Work

1. **Check Edge Function Logs:**
   - Go to **Edge Functions** → **Logs**
   - Select `scrape-post`
   - Look for error messages

2. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Try scraping and look for errors

3. **Common Issues:**
   - Secrets not set → Add them in Edge Functions → Settings → Secrets
   - Function not deployed → Redeploy the function
   - Wrong secret names → Make sure they match exactly (case-sensitive)

