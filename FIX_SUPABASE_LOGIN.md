# Fix Supabase Login - Too Many Access Tokens

## The Problem
You have 20 personal access tokens (the maximum), so Supabase can't create a new login session.

## Solution: Remove Old Tokens

### Step 1: Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Make sure you're logged in to the web dashboard

### Step 2: Access Personal Access Tokens
1. Click your **profile icon** (top right)
2. Go to **Account Settings** or **Access Tokens**
3. Or go directly to: https://supabase.com/dashboard/account/tokens

### Step 3: Delete Old Tokens
1. You'll see a list of all your personal access tokens
2. **Delete the oldest/unused ones** (you can keep the most recent ones)
3. You need to delete at least 1 token to create a new login session
4. Click the **Delete** or **Remove** button next to each token you want to remove

**Tip:** Look for:
- Tokens with old "Created" dates
- Tokens you don't recognize
- Tokens that are no longer in use

### Step 4: Try Login Again
After deleting at least one token, go back to your terminal and try:

```bash
supabase login
```

This should now work!

## Alternative: Use Existing Token

If you have a token that still works, you can use it directly without logging in:

```bash
# Set the token as an environment variable
export SUPABASE_ACCESS_TOKEN=your_existing_token_here

# Or use it inline
SUPABASE_ACCESS_TOKEN=your_token supabase functions deploy soundtrack_start_scrape
```

## Quick Steps Summary

1. ✅ Go to https://supabase.com/dashboard/account/tokens
2. ✅ Delete 1-2 old/unused tokens
3. ✅ Run `supabase login` in terminal
4. ✅ Continue with deploying functions

## After Login Works

Once you can login, run these commands:

```bash
# Deploy the scraping functions
supabase functions deploy soundtrack_start_scrape
supabase functions deploy soundtrack_scrape_webhook

# Set Apify token (get from https://console.apify.com/account/integrations)
supabase secrets set APIFY_API_TOKEN=your_apify_token_here
```
