# Deploy soundtrack_create_from_link Function

## Quick Deploy

The frontend is calling `soundtrack_create_from_link` but it doesn't exist. I've created a wrapper function that forwards requests to your existing `sound-tracking` function.

### Option 1: Deploy via CLI

```bash
supabase functions deploy soundtrack_create_from_link
```

### Option 2: Deploy via Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it: `soundtrack_create_from_link`
4. Copy the code from `supabase/functions/soundtrack_create_from_link/index.ts`
5. Paste and deploy

## What This Function Does

This is a thin wrapper that:
1. Receives requests from the frontend in the format: `{ workspaceId, url }`
2. Forwards them to `sound-tracking` function in the format: `{ action: "ingest", url }`
3. Returns the response in the format the frontend expects

## Required Secrets

Make sure these are set in Supabase Edge Functions secrets:
- ✅ `APIFY_API_TOKEN` (you already have this)
- ✅ `RAPIDAPI_KEY`
- ✅ `SUPABASE_URL` (or `SB_URL`)
- ✅ `SUPABASE_ANON_KEY` (or `SB_ANON_KEY`)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (or `SB_SERVICE_ROLE_KEY`)

## After Deploying

Test it:
1. Go to `/sounds/new` in your app
2. Paste a TikTok music URL
3. Click "Start Tracking"
4. Should work now! ✅
