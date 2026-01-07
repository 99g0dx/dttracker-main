# Fix HTTP 401 Error - Authentication Failed

The 401 error means the Edge Function can't verify your authentication. This is usually because required secrets aren't configured.

## Quick Fix: Set Required Secrets

1. **Go to Supabase Dashboard**
2. **Navigate to Edge Functions** → **Settings** → **Secrets**
3. **Add these required secrets:**

### Required Secrets:

#### 1. SUPABASE_URL
- **Value:** Your Supabase project URL
- **Where to find it:** Settings → API → Project URL
- **Example:** `https://abcdefghijklmnop.supabase.co`

#### 2. SUPABASE_SERVICE_ROLE_KEY
- **Value:** Your service role key (⚠️ Keep this secret!)
- **Where to find it:** Settings → API → `service_role` key (the secret one, not the anon key)
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Optional Secrets (for real scraping data):

#### 3. RAPIDAPI_KEY
- **Value:** Your RapidAPI key
- **Get it from:** https://rapidapi.com/
- **Note:** Without this, TikTok/Instagram will return mock data

#### 4. YOUTUBE_API_KEY
- **Value:** Your YouTube Data API v3 key
- **Get it from:** https://console.cloud.google.com/apis/credentials
- **Note:** Without this, YouTube will return mock data

## Step-by-Step Instructions

### Step 1: Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **service_role key** (the long secret key, NOT the anon key)

### Step 2: Add Secrets to Edge Function

1. Go to **Edge Functions** → **Settings** → **Secrets**
2. Click **"Add new secret"** for each:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: (paste your Project URL)
   - Click **"Add secret"**

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (paste your service_role key)
   - Click **"Add secret"**

### Step 3: Verify Secrets Are Set

1. Go back to **Edge Functions** → **Settings** → **Secrets**
2. You should see:
   - ✅ `SUPABASE_URL`
   - ✅ `SUPABASE_SERVICE_ROLE_KEY`
   - (Optional) `RAPIDAPI_KEY`
   - (Optional) `YOUTUBE_API_KEY`

### Step 4: Test Again

1. Try scraping a post again
2. The 401 error should be gone
3. If you still get errors, check Edge Function logs

## Important Notes

⚠️ **Service Role Key is Secret:**
- Never share this key publicly
- Never commit it to git
- Only use it in Edge Functions (server-side)

✅ **After Adding Secrets:**
- The Edge Function will automatically use them
- No need to redeploy
- Changes take effect immediately

## Still Getting 401?

If you still get 401 after setting secrets:

1. **Check Edge Function Logs:**
   - Go to **Edge Functions** → **Logs**
   - Look for authentication errors
   - Check if secrets are being read

2. **Verify Secret Names:**
   - Must be exactly: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Case-sensitive
   - No extra spaces

3. **Check You're Logged In:**
   - Make sure you're logged into the app
   - Try logging out and back in
   - Check browser console for auth errors

4. **Redeploy Function (if needed):**
   - Sometimes secrets need a redeploy to be picked up
   - Go to **Edge Functions** → Click on `scrape-post` → **Redeploy**

## What the Secrets Do

- **SUPABASE_URL**: Tells the function where your Supabase project is
- **SUPABASE_SERVICE_ROLE_KEY**: Allows the function to verify user tokens (bypasses RLS)
- **RAPIDAPI_KEY**: Enables real TikTok/Instagram scraping (optional)
- **YOUTUBE_API_KEY**: Enables real YouTube scraping (optional)

Without the first two secrets, authentication will always fail with 401.

