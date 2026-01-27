# Fix 401 Unauthorized Error

## The Problem

You're getting `401 (Unauthorized)` when calling `soundtrack_create_from_link`. This means Supabase's infrastructure is blocking the request **before** your function code runs.

## Root Cause

Even though `config.toml` has `verify_jwt = false`, Supabase might:
1. **Not have the config applied** - Function needs to be redeployed
2. **Still require JWT** - Some Supabase versions still check JWT even with `verify_jwt = false`
3. **Have caching issues** - Config changes might not be reflected immediately

## Solutions

### Solution 1: Redeploy the Function (Most Likely Fix)

The config change might not be applied. Redeploy:

```bash
# Make sure you're logged in
supabase login

# Deploy the function (this will apply config.toml)
supabase functions deploy soundtrack_create_from_link
```

**Verify the deployment:**
```bash
supabase functions list
```

Should show `soundtrack_create_from_link` in the list.

### Solution 2: Check Function Logs

1. Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. Click on `soundtrack_create_from_link`
3. Go to "Logs" tab
4. Try creating a sound track again
5. **Look for:** `🔵 soundtrack_create_from_link: FUNCTION HIT`

**If you see this log:**
- ✅ Function is running (401 is from something else)
- Check the rest of the logs for the actual error

**If you DON'T see this log:**
- ❌ Supabase is blocking before function runs
- Function needs to be redeployed or config isn't working

### Solution 3: Verify Config File

Make sure `supabase/functions/soundtrack_create_from_link/config.toml` exists and contains:

```toml
# Edge Function Configuration
# Disable JWT verification to avoid auth blockers
verify_jwt = false
```

### Solution 4: Test Direct API Call

Test the function directly to see the actual error:

```bash
# Get your anon key from .env
ANON_KEY="your-anon-key-here"

curl -X POST "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/soundtrack_create_from_link" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"workspaceId":"test","url":"https://www.tiktok.com/music/test-123"}'
```

**Expected:** Should return 200 or 500 (not 401)

**If you get 401:** Function config isn't applied → Redeploy

**If you get 500:** Function is running but has an error → Check logs

### Solution 5: Use Service Role Key (Workaround)

If `verify_jwt = false` isn't working, you can call the function with service role key:

**⚠️ WARNING:** Only do this if you understand the security implications. Service role key bypasses all RLS.

```typescript
// In src/lib/api/sound-tracks.ts (temporary workaround)
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Don't expose this in production!
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};
```

**Better approach:** Fix the config instead of using service role key.

## What I Changed

1. ✅ **Enhanced error logging** - Now shows error status and context
2. ✅ **Better 401 error messages** - Tells you to redeploy
3. ✅ **Added header logging** - Shows if auth headers are present
4. ✅ **Improved error extraction** - Tries to get actual error response body

## Next Steps

1. **Redeploy the function:**
   ```bash
   supabase functions deploy soundtrack_create_from_link
   ```

2. **Test again** - Should work now

3. **If still 401:**
   - Check Supabase dashboard → Edge Functions → `soundtrack_create_from_link` → Settings
   - Verify `verify_jwt` is set to `false`
   - Try redeploying again

4. **Check logs** - Look for `🔵 FUNCTION HIT` to confirm function is running

The function should work after redeployment! 🚀
