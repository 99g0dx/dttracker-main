# Deploy Team Invite Email Function

This guide will help you deploy the `send-team-invite` Edge Function to Supabase.

## Prerequisites

1. **Supabase CLI installed** (already installed: v2.67.1)
2. **Supabase account** with an active project
3. **Resend account** (free tier available at https://resend.com)
4. **Linked Supabase project** (see Step 1 below)

## Step-by-Step Deployment

### Step 1: Link Your Supabase Project (if not already linked)

1. **Login to Supabase CLI:**
   ```bash
   supabase login
   ```
   This will open your browser for authentication.

2. **Get your Project Reference:**
   - Go to https://app.supabase.com/dashboard
   - Click on your project
   - The project reference is in the URL: `https://app.supabase.com/project/YOUR-PROJECT-REF`
   - Copy the `YOUR-PROJECT-REF` part

3. **Link the project:**
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   ```
   Replace `YOUR-PROJECT-REF` with your actual project reference.

   You'll be asked for your database password. You can find it in:
   - Supabase Dashboard → Project Settings → Database → Database Password

### Step 2: Deploy the Edge Function

From the project root directory, run:

```bash
supabase functions deploy send-team-invite
```

This will:
- Upload the function code to Supabase
- Make it available at `https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-team-invite`

**If you get errors:**
- Make sure you're in the project root directory: `/Users/apple/Downloads/DTTracker UI Design Enhancements 2`
- Verify the file exists: `ls -la supabase/functions/send-team-invite/index.ts`
- Try running with debug: `supabase functions deploy send-team-invite --debug`

### Step 3: Set Up Resend API Key

1. **Create a Resend account** (if you don't have one):
   - Go to https://resend.com
   - Sign up for free (100 emails/day on free tier)
   - Verify your email

2. **Get your API key:**
   - Go to https://resend.com/api-keys
   - Click "Create API Key"
   - Give it a name (e.g., "DTTracker Team Invites")
   - Copy the API key (you'll only see it once!)

3. **Add API key to Supabase:**
   - Go to your Supabase Dashboard
   - Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
   - Click **Add new secret**
   - Name: `RESEND_API_KEY`
   - Value: Paste your Resend API key
   - Click **Save**

### Step 4: Configure Email "From" Address

The Edge Function needs a verified domain/email to send from.

**Option A: Use Resend's test domain (Quick Start):**
- Resend provides `onboarding@resend.dev` for testing
- Edit `supabase/functions/send-team-invite/index.ts`
- Find line ~126: `from: "DTTracker <invites@dttracker.com>",`
- Change to: `from: "DTTracker <onboarding@resend.dev>",`
- Redeploy: `supabase functions deploy send-team-invite`

**Option B: Use your own domain (Production):**
1. In Resend Dashboard → Domains
2. Add your domain (e.g., `dttracker.com`)
3. Follow DNS verification steps
4. Once verified, use: `from: "DTTracker <invites@yourdomain.com>",`
5. Redeploy the function

### Step 5: Test the Function

1. **Create a test invite** in your app
2. Check the browser console for any errors
3. Check the invitee's email inbox (and spam folder)
4. Verify the email contains the invite link

## Troubleshooting

### Error: "Entrypoint path does not exist"
- Make sure you're in the project root directory
- Check that `supabase/functions/send-team-invite/index.ts` exists
- Try: `ls -la supabase/functions/send-team-invite/`

### Error: "Docker is not running"
- This warning is OK for remote deployments (deploying to Supabase cloud)
- Only needed for local development/testing
- Your deployment should still work

### Error: "Project not linked"
- Run `supabase link --project-ref YOUR-PROJECT-REF` first
- Check if `.supabase` directory exists in your project root

### Emails not sending
- Verify `RESEND_API_KEY` is set in Supabase Dashboard → Edge Functions → Secrets
- Check Resend dashboard for delivery status: https://resend.com/emails
- Check Edge Function logs in Supabase Dashboard → Edge Functions → send-team-invite → Logs
- Make sure the "from" email is using a verified domain/email

### Function deployed but emails fail
- Check the Edge Function logs in Supabase Dashboard
- Verify the Resend API key is correct
- Check if you've exceeded Resend's rate limits (100/day on free tier)
- Ensure the "from" address uses a verified domain

## Quick Deploy Script

You can also use this one-liner (after linking):

```bash
supabase functions deploy send-team-invite && echo "✓ Function deployed! Don't forget to set RESEND_API_KEY in Supabase Dashboard → Edge Functions → Secrets"
```

## Next Steps

After successful deployment:
1. ✅ Function is deployed
2. ✅ Resend API key is configured
3. ✅ Email "from" address is set
4. Test creating a team invite in your app
5. Verify the invite email is received

## Reference

- Supabase Edge Functions Docs: https://supabase.com/docs/guides/functions
- Resend API Docs: https://resend.com/docs/api-reference/emails/send-email
- Resend Dashboard: https://resend.com/emails

