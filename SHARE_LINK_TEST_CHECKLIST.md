# Share Link Regeneration - Test Checklist

## Deployment Status
- ✅ Code committed and pushed to GitHub
- ✅ Vercel deployment triggered (check: https://vercel.com/dashboard)
- ✅ Supabase Edge Function deployed

---

## Test 1: Basic Regeneration with New Expiration
**Goal:** Verify user can choose expiration when regenerating

### Steps:
1. [ ] Go to your Vercel deployment URL
2. [ ] Navigate to any campaign
3. [ ] Click the "Share" button in campaign detail page
4. [ ] In the Share modal, toggle "Enable view-only link" to ON
5. [ ] Set expiration to "30 days"
6. [ ] Copy the generated link (Link A)
7. [ ] Change expiration dropdown to "7 days"
8. [ ] Click "Regenerate Link" button
9. [ ] Verify toast shows: "Link regenerated. Expires in 7 days."
10. [ ] Copy the new link (Link B)

### Expected Results:
- [ ] Link A is different from Link B
- [ ] Link A should now show error (invalidated)
- [ ] Link B should work and expire in 7 days from now

---

## Test 2: Regenerate Expired Link
**Goal:** Verify expired links can be regenerated with new expiration

### Steps:
1. [ ] Open Supabase SQL Editor
2. [ ] Run this query to find your campaign's share settings:
   ```sql
   SELECT id, name, share_token, share_expires_at, share_created_at
   FROM campaigns
   WHERE share_enabled = true
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. [ ] Manually expire the link:
   ```sql
   UPDATE campaigns
   SET share_expires_at = NOW() - INTERVAL '1 day'
   WHERE id = 'YOUR_CAMPAIGN_ID';
   ```
4. [ ] Try accessing the share link → should see "Link expired"
5. [ ] Go back to Share modal in your app
6. [ ] Set expiration to "24 hours"
7. [ ] Click "Regenerate Link"
8. [ ] Verify toast: "Link regenerated. Expires in 24 hours."
9. [ ] Test the new link → should work

### Expected Results:
- [ ] Old link shows expiration error with date
- [ ] New link works immediately
- [ ] New link expires 24 hours from regeneration time

---

## Test 3: Regenerate with "Never" Expiration
**Goal:** Verify permanent links can be created

### Steps:
1. [ ] Open Share modal
2. [ ] Change expiration dropdown to "Never"
3. [ ] Click "Regenerate Link"
4. [ ] Verify toast: "Link regenerated. Never expires."
5. [ ] Check database:
   ```sql
   SELECT share_expires_at FROM campaigns WHERE id = 'YOUR_CAMPAIGN_ID';
   ```
6. [ ] `share_expires_at` should be NULL

### Expected Results:
- [ ] Toast confirms "Never expires"
- [ ] Link works in incognito mode
- [ ] Database has `share_expires_at = NULL`

---

## Test 4: Helper Text Visibility
**Goal:** Verify UI shows helpful information

### Steps:
1. [ ] Open Share modal with sharing enabled
2. [ ] Look below the "Link Expires" dropdown
3. [ ] Verify helper text is visible: "This expiration will be applied when regenerating the link"

### Expected Results:
- [ ] Helper text is clearly visible
- [ ] Text is readable (light gray color)

---

## Test 5: Error Messages
**Goal:** Verify improved error messages work

### Steps:
1. [ ] In Supabase SQL Editor, disable a share link:
   ```sql
   UPDATE campaigns
   SET share_enabled = false
   WHERE id = 'YOUR_CAMPAIGN_ID';
   ```
2. [ ] Try accessing the share link
3. [ ] Check browser console for error details
4. [ ] Check Supabase Edge Function logs:
   - Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
   - Click "share-campaign" function
   - View logs

### Expected Results:
- [ ] Error message is specific (not just generic "Link not found")
- [ ] Console shows detailed error
- [ ] Edge Function logs show token (first 8 chars) for debugging

---

## Test 6: Password Protection Persistence
**Goal:** Verify password settings survive regeneration

### Steps:
1. [ ] Enable sharing for a campaign
2. [ ] Toggle "Password Protection" ON
3. [ ] Set password: "testpass123"
4. [ ] Click save/update
5. [ ] Click "Regenerate Link"
6. [ ] Try accessing new link → should ask for password
7. [ ] Enter "testpass123" → should grant access

### Expected Results:
- [ ] Password protection persists after regeneration
- [ ] Correct password grants access
- [ ] Wrong password shows error

---

## Test 7: Multiple Expiration Options
**Goal:** Verify all expiration options work

Test each option:
- [ ] Never → Link never expires
- [ ] 24 hours → Expires in 1 day
- [ ] 7 days → Expires in 1 week
- [ ] 30 days → Expires in 1 month
- [ ] 60 days → Expires in 2 months
- [ ] 90 days → Expires in 3 months

### For each option:
1. Set expiration in dropdown
2. Regenerate link
3. Verify toast shows correct duration
4. Check database `share_expires_at` is correct

---

## Test 8: Edge Cases

### A. Regenerate immediately after creation
- [ ] Create new share link
- [ ] Immediately click "Regenerate"
- [ ] Should work without errors

### B. Regenerate multiple times in a row
- [ ] Click "Regenerate" 5 times quickly
- [ ] All should succeed
- [ ] Only last link should work

### C. Incognito/Private browsing
- [ ] Open generated link in incognito/private window
- [ ] Should work without login
- [ ] Should show view-only dashboard

---

## Troubleshooting

If tests fail:

### Vercel deployment not live yet:
- Check: https://vercel.com/dashboard
- Wait for "Ready" status
- Look for any build errors

### Edge Function errors:
- Check logs: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions
- Look for console.error messages with token info
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set

### Database schema issues:
Run these checks:
```sql
-- Check if password columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name IN ('share_password_hash', 'share_password_protected');

-- Check if share fields exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name LIKE 'share_%';
```

If columns missing, run:
- `database/add_campaign_share_fields.sql`
- `database/add_campaign_share_password.sql`

---

## Success Criteria

All tests should pass:
- [x] Commit pushed to GitHub
- [x] Vercel deployment complete
- [x] Edge Function deployed
- [ ] Test 1: Basic regeneration works
- [ ] Test 2: Expired link regeneration works
- [ ] Test 3: "Never" expiration works
- [ ] Test 4: Helper text visible
- [ ] Test 5: Error messages improved
- [ ] Test 6: Password protection persists
- [ ] Test 7: All expiration options work
- [ ] Test 8: Edge cases handled

---

## Quick Test (5 minutes)

If you just want to verify the fix quickly:

1. [ ] Go to campaign → Click Share button
2. [ ] Enable sharing with 30-day expiration
3. [ ] Change dropdown to 7 days
4. [ ] Click "Regenerate Link"
5. [ ] See toast: "Link regenerated. Expires in 7 days."
6. [ ] Test link in incognito → works ✅

**This confirms the main bug is fixed!**
