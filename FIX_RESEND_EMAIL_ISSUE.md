# Fix Resend Email Sending Issue

If you're getting "Email sending failed" even after adding `RESEND_API_KEY` to Supabase, follow these steps:

## Step 1: Verify Secret is Set Correctly

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to: **Settings** (gear icon) → **Edge Functions** → **Secrets**
3. Verify `RESEND_API_KEY` exists:
   - **Name**: `RESEND_API_KEY` (must be exact)
   - **Value**: Should start with `re_` (e.g., `re_Vqp1hySh_LiG5XYNoHh2H7ScGR16qfyk5`)
4. If it's missing or wrong:
   - Click **"Add new secret"** or **"Edit"**
   - Name: `RESEND_API_KEY`
   - Value: `re_Vqp1hySh_LiG5XYNoHh2H7ScGR16qfyk5`
   - Click **Save**

## Step 2: Redeploy the Edge Function

**IMPORTANT**: After adding/updating secrets, you MUST redeploy the edge function for it to pick up the new secret.

### Option A: Redeploy via Supabase Dashboard (Recommended)

1. Go to **Edge Functions** in the left sidebar
2. Find `send-team-invite` function
3. Click on it to open
4. Click **"Deploy"** button (even if already deployed, redeploy to pick up new secrets)

### Option B: Redeploy via Supabase CLI

```bash
# Make sure you're in the project directory
cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Set the secret (if not already set)
supabase secrets set RESEND_API_KEY=re_Vqp1hySh_LiG5XYNoHh2H7ScGR16qfyk5

# Deploy the function
supabase functions deploy send-team-invite
```

## Step 3: Test the Edge Function Directly

1. Get your Supabase project URL and anon key
2. Test the function with curl or Postman:

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-team-invite' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "inviteToken": "test-token-123",
    "inviterName": "Test User",
    "role": "member",
    "message": "Test invite",
    "inviteUrl": "https://yourapp.com/invite/test-token-123"
  }'
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference ID
- `YOUR_ANON_KEY` with your Supabase anon key

## Step 4: Check Resend API Domain

The edge function currently uses Resend's test domain: `onboarding@resend.dev`

If emails still fail:
1. Go to **Resend Dashboard** → **Domains**
2. Add and verify your own domain (recommended for production)
3. Update the `from` address in `supabase/functions/send-team-invite/index.ts`:
   ```typescript
   from: "DTTracker <noreply@yourdomain.com>",
   ```
4. Redeploy the edge function

## Step 5: Check Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → `send-team-invite`
2. Click **"Logs"** tab
3. Look for errors when you try to send an invite
4. Common errors:
   - `RESEND_API_KEY not configured` → Secret not set or function not redeployed
   - `401 Unauthorized` → Invalid API key
   - `422 Unprocessable Entity` → Invalid email format or domain not verified

## Step 6: Verify Resend API Key is Valid

1. Go to **Resend Dashboard** → **API Keys**
2. Verify your API key (`re_Vqp1hySh_LiG5XYNoHh2H7ScGR16qfyk5`) exists and is active
3. If it's not working, create a new API key and update it in Supabase

## Quick Checklist

- [ ] `RESEND_API_KEY` secret is set in Supabase Edge Functions secrets
- [ ] Edge function `send-team-invite` has been **redeployed** after setting secret
- [ ] Resend API key is valid and active in Resend dashboard
- [ ] Test the edge function directly via curl/Postman
- [ ] Check edge function logs for detailed error messages
- [ ] Verify domain in Resend (if using custom domain)

## Most Common Issue

**The #1 cause**: Edge function wasn't redeployed after adding the secret. **You must redeploy** for secrets to take effect!

