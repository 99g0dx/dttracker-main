# Quick Deploy: Team Invite Email Function

## TL;DR - Fastest Path

1. **Link your Supabase project** (one-time setup):
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```

2. **Deploy the function**:
   ```bash
   supabase functions deploy send-team-invite
   ```

3. **Set Resend API key** in Supabase Dashboard:
   - Go to: Project Settings → Edge Functions → Secrets
   - Add: `RESEND_API_KEY` = `your-resend-api-key`
   - Get key from: https://resend.com/api-keys

4. **Done!** The function is configured to use `onboarding@resend.dev` for testing.

## Detailed Steps

### 1. Link Project (If Not Already Linked)

```bash
# Login to Supabase
supabase login

# Link to your project
# Get PROJECT_REF from: https://app.supabase.com/dashboard → Your Project → URL shows the ref
supabase link --project-ref YOUR-PROJECT-REF
```

### 2. Deploy Function

```bash
# From project root directory
supabase functions deploy send-team-invite
```

### 3. Get Resend API Key

1. Sign up at https://resend.com (free)
2. Go to https://resend.com/api-keys
3. Create API key
4. Copy it (shown only once!)

### 4. Add Secret to Supabase

1. Supabase Dashboard → Your Project
2. Settings → Edge Functions → Secrets
3. Click "Add new secret"
4. Name: `RESEND_API_KEY`
5. Value: (paste your Resend API key)
6. Save

### 5. Test It!

Create a team invite in your app and check the email!

## Current Configuration

- ✅ Function uses `onboarding@resend.dev` (Resend's test domain - works immediately)
- ✅ No domain verification needed for testing
- ✅ Free tier: 100 emails/day

## For Production (Later)

When ready, replace `onboarding@resend.dev` with your verified domain:
1. Add domain in Resend Dashboard
2. Verify DNS records
3. Update `from` address in the function
4. Redeploy

See `DEPLOY_TEAM_INVITE_FUNCTION.md` for full details.

