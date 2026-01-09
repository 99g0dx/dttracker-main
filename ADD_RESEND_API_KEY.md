# Add Resend API Key to Supabase

## Steps to Add the Secret

1. **Go to Supabase Dashboard:**
   - Visit: https://app.supabase.com/dashboard
   - Click on your project

2. **Navigate to Edge Functions Secrets:**
   - Click **Settings** (gear icon) in the left sidebar
   - Click **Edge Functions** in the settings menu
   - Click on the **Secrets** tab

3. **Add the Secret:**
   - Click **Add new secret** button
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_jkgh1Hsh_BLdB9cJAsCEyYFaqn58hB6gv`
   - Click **Save**

4. **Verify:**
   - You should see `RESEND_API_KEY` listed in your secrets

## After Adding the Secret

Once the secret is added, your Edge Function will automatically be able to use it. The function reads this value from `Deno.env.get("RESEND_API_KEY")`.

## Security Note

⚠️ **Important:** This API key is now shared. Consider:
- After adding it to Supabase, you can revoke this key in Resend and create a new one if you want
- Never commit API keys to git
- Never share API keys publicly

## Next Steps

After adding the secret:
1. Deploy or redeploy the function: `supabase functions deploy send-team-invite`
2. Test by creating a team invite in your app
3. Check the email inbox for the invitation

