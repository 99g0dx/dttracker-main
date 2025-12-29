# Setup Gemini API Key for Creator Extraction

This guide explains how to securely configure your Gemini API key for the creator extraction Edge Function.

## ⚠️ Security Note

**Never commit API keys to your repository or hardcode them in your source files.** Always use environment variables/secrets.

## Setup Steps

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Find the `extract-creator-info` function (or create it if it doesn't exist)

3. **Set the Secret/Environment Variable**
   - Click on the `extract-creator-info` function
   - Go to **Settings** tab
   - Scroll to **Secrets** section
   - Click **Add new secret**
   - Enter:
     - **Name:** `GEMINI_API_KEY`
     - **Value:** `AIzaSyDVTm48hpyHlbl8Bc-TcjFuZ2slwcfipyk`
   - Click **Save**

4. **Deploy the function** (if you haven't already)
   - Go to the function's code editor
   - Ensure the code from `supabase/functions/extract-creator-info/index.ts` is deployed
   - Click **Deploy**

### Option 2: Using Supabase CLI

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project** (if not already linked):
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Supabase dashboard → Settings → General)

4. **Set the secret**:
   ```bash
   supabase secrets set GEMINI_API_KEY=AIzaSyDVTm48hpyHlbl8Bc-TcjFuZ2slwcfipyk
   ```

5. **Deploy the function**:
   ```bash
   supabase functions deploy extract-creator-info
   ```

## Verify Setup

1. **Check the function logs**:
   - Go to Edge Functions → `extract-creator-info` → Logs
   - Try uploading an image to extract creator info
   - You should NOT see "Gemini API key not configured" errors

2. **Test the extraction**:
   - Go to the Creator Scraper page in your app
   - Upload a social media profile screenshot
   - Click "Extract Creator Info"
   - It should successfully extract the information

## Troubleshooting

### "Gemini API key not configured" Error

**Causes:**
- Secret not set in Supabase
- Secret name is incorrect (must be exactly `GEMINI_API_KEY`)
- Function not redeployed after setting secret

**Solutions:**
1. Double-check the secret name is exactly `GEMINI_API_KEY` (case-sensitive)
2. Verify the secret value is correct
3. Redeploy the function after setting the secret
4. Check Edge Function logs for more details

### "Invalid API key" or "401" Errors

**Causes:**
- API key is incorrect or expired
- API key doesn't have proper permissions

**Solutions:**
1. Verify your API key is correct
2. Check if the API key is active in Google AI Studio
3. Ensure the API key has access to Gemini API
4. Generate a new API key if needed

### Function Not Found

**Causes:**
- Function not deployed
- Function name mismatch

**Solutions:**
1. Deploy the function: `supabase functions deploy extract-creator-info`
2. Verify the function name matches exactly

## Getting a New Gemini API Key

If you need to generate a new API key:

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Get API key** or **Create API key**
3. Copy the new key
4. Update the secret in Supabase using the steps above

## Important Notes

- The API key is stored securely as a secret in Supabase
- It's only accessible to your Edge Functions at runtime
- The key is never exposed to the client-side code
- You can rotate the key anytime by updating the secret in Supabase



