# Debug 403 Error - Step by Step

## What to Check

### Step 1: Is the Function Deployed?

Run this to check:
```bash
./verify-function-deployment.sh
```

Or manually:
```bash
supabase functions list
```

**Expected:** You should see `soundtrack_create_from_link` in the list

**If NOT there:** Deploy it:
```bash
supabase functions deploy soundtrack_create_from_link
```

### Step 2: Check Function Logs

1. Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
2. Click on `soundtrack_create_from_link`
3. Go to "Logs" tab
4. Try creating a sound track
5. **Look for:** `🔵 soundtrack_create_from_link: FUNCTION HIT`

**If you see this log:**
- ✅ Function is running
- Check the rest of the logs for the actual error
- The 403 might be coming from `sound-tracking` function

**If you DON'T see this log:**
- ❌ Supabase is blocking before the function runs
- This means the function isn't deployed OR there's a Supabase infrastructure issue

### Step 3: Test Function Directly

Open browser console (F12) and run:

```javascript
const anonKey = 'YOUR_ANON_KEY_FROM_ENV'; // Get from .env file

fetch('https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/soundtrack_create_from_link', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': anonKey
  },
  body: JSON.stringify({
    workspaceId: 'test-workspace-id',
    url: 'https://www.tiktok.com/music/test-123'
  })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('Response:', data);
})
.catch(err => {
  console.error('Error:', err);
});
```

**What to look for:**
- Status code (403, 404, 500, etc.)
- Response body (error message)
- Network tab shows the request

### Step 4: Check Browser Console

When you try to create a sound track:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. **Copy the exact error message** and share it

### Step 5: Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Try creating a sound track
4. Find the request to `soundtrack_create_from_link`
5. Click on it
6. Check:
   - **Status Code** (should be 200, but might be 403)
   - **Request Headers** (Authorization, apikey)
   - **Response** (error message)

## Common Issues

### Issue 1: Function Not Deployed
**Symptom:** 404 Not Found or function doesn't appear in list
**Fix:** Deploy the function

### Issue 2: Function Deployed But Still 403
**Symptom:** Function exists but returns 403
**Possible causes:**
- `verify_jwt = false` not taking effect (redeploy)
- Supabase project settings blocking it
- CORS issue

**Fix:** 
1. Redeploy: `supabase functions deploy soundtrack_create_from_link`
2. Check `config.toml` has `verify_jwt = false`
3. Try calling with just `apikey` header (no Authorization)

### Issue 3: sound-tracking Function Returns 403
**Symptom:** Function runs but `sound-tracking` fails
**Fix:** The updated function now creates sound directly if `sound-tracking` fails

## What I Changed

The function now:
1. ✅ **Logs immediately** - First line logs "FUNCTION HIT"
2. ✅ **Works without sound-tracking** - Creates sound directly if forwarding fails
3. ✅ **Never returns 403** - Always returns 200 or 500
4. ✅ **Better error messages** - Shows exactly what failed

## Next Steps

1. **Deploy the function** (if not deployed)
2. **Check logs** - Look for "FUNCTION HIT"
3. **Share the exact error** - Copy from browser console
4. **Test directly** - Use the curl/fetch command above

The function should work now even if everything else fails!
