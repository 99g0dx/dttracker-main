# Deploy Edge Function for Scraping

The "Failed to fetch" error means the Edge Function isn't deployed or reachable. Follow these steps to deploy it.

## Quick Deploy (Recommended)

### Option 1: Using Supabase Dashboard

1. **Go to your Supabase project dashboard**
2. **Navigate to Edge Functions** in the left sidebar
3. **Click "Create a new function"**
4. **Name it:** `scrape-post`
5. **Copy the code** from `supabase/functions/scrape-post/index.ts`
6. **Paste it** into the editor
7. **Click "Deploy"**

### Option 2: Using Supabase CLI

1. **Install Supabase CLI** (if not already installed):

   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:

   ```bash
   supabase login
   ```

3. **Link your project**:

   ```bash
   supabase link --project-ref your-project-ref
   ```

   (Find your project ref in Supabase dashboard → Settings → General)

4. **Deploy the function**:
   ```bash
   supabase functions deploy scrape-post
   ```

## Configure Secrets

After deploying, you need to set up API keys:

1. **Go to Edge Functions** → **Settings** → **Secrets**
2. **Add the following secrets**:

   - **RAPIDAPI_KEY** - Your RapidAPI key

     - Get it from: https://rapidapi.com/
     - Subscribe to: "TikTok Video No Watermark" and "Instagram Scraper API2"

   - **YOUTUBE_API_KEY** (optional) - Your YouTube Data API v3 key

     - Get it from: https://console.cloud.google.com/apis/credentials
     - See `GET_YOUTUBE_API_KEY.md` for instructions

   - **SUPABASE_URL** - Your Supabase project URL

     - Found in: Settings → API → Project URL

   - **SUPABASE_SERVICE_ROLE_KEY** - Your service role key
     - Found in: Settings → API → service_role key (⚠️ Keep this secret!)

## Verify Deployment

1. **Check Edge Functions** → **Logs**
2. **Try scraping a post**
3. **Check the logs** for any errors

## Troubleshooting

### "Failed to fetch" Error

**Causes:**

- Edge Function not deployed
- Incorrect Supabase URL in `.env`
- Network/CORS issues

**Solutions:**

1. Verify the function is deployed (Edge Functions → Functions list)
2. Check your `.env` file has the correct `VITE_SUPABASE_URL`
3. Check browser console for CORS errors
4. Verify your internet connection

### "Unauthorized" Error

**Causes:**

- Missing or incorrect service role key
- Authentication token expired

**Solutions:**

1. Check `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
2. Try logging out and logging back in
3. Check that your session is valid

### Function Not Found

**Causes:**

- Function name mismatch
- Function not deployed to correct project

**Solutions:**

1. Verify function name is exactly `scrape-post`
2. Check you're deploying to the correct Supabase project
3. Redeploy the function

## Testing

After deployment, test by:

1. **Go to a campaign with posts**
2. **Click "Scrape All Posts"**
3. **Check the toast notification** for success/error
4. **Check Edge Function logs** for detailed information

## Next Steps

Once deployed:

- ✅ Scraping should work
- ✅ Check logs if errors occur
- ✅ Verify API keys are set if you want real data (not mock data)
