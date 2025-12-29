# Setting Your RapidAPI Key

## Your RapidAPI Key
```
e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454
```

## Steps to Set the Secret

### Step 1: Login to Supabase CLI (if not already logged in)
```bash
supabase login
```
This will open a browser window for you to authenticate.

### Step 2: Link Your Project (if not already linked)
```bash
supabase link --project-ref ucbueapoexnxhttynfzy
```

### Step 3: Set the RapidAPI Key Secret
```bash
supabase secrets set RAPIDAPI_KEY=e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454
```

### Step 4: Verify the Secret Was Set
```bash
supabase secrets list
```
You should see `RAPIDAPI_KEY` in the list.

### Step 5: Redeploy the Edge Function
```bash
supabase functions deploy scrape-post
```

## Alternative: Set via Supabase Dashboard

If you prefer using the web interface:

1. Go to your Supabase Dashboard: https://app.supabase.com/project/ucbueapoexnxhttynfzy
2. Navigate to **Edge Functions** → **scrape-post**
3. Click on **Settings** or **Secrets**
4. Add a new secret:
   - **Name**: `RAPIDAPI_KEY`
   - **Value**: `e41e99bccfmsh403c86e483970b8p170883jsn7cbb7d041454`
5. Save the secret
6. The function will automatically pick it up (or redeploy if needed)

## After Setting the Key

Once the secret is set and the function is redeployed:
- ✅ TikTok scraping will use the real API (not mock data)
- ✅ Instagram scraping will use the real API (if you have that subscription too)
- ✅ You should see real metrics instead of random mock data

## Test It

1. After setting the secret and redeploying, try scraping a TikTok post
2. Check the Edge Function logs to see if it's using the API successfully
3. The post should show real metrics (views, likes, comments, etc.)

## Troubleshooting

If you still get 403 errors after setting the key:
1. **Check your RapidAPI subscription**: Make sure you're subscribed to:
   - "TikTok Video No Watermark" API
   - "Instagram Scraper API" (if scraping Instagram)
2. **Verify the key is correct**: Check your RapidAPI dashboard
3. **Check Edge Function logs**: Look for API error messages

