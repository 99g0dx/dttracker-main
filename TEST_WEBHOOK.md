# Webhook Backend Test

## Test 1: Run Database Migration & Fix

**Open**: Supabase Dashboard > SQL Editor

**Copy and run**: [BACKEND_TEST.sql](BACKEND_TEST.sql)

**Expected Output**:
```
✅ RPC function updated
✅ Inconsistent quotes fixed
✅ All quotes show consistent statuses
✅ inconsistencies count = 0
```

---

## Test 2: Test Webhook Function (Manual)

You can test the webhook function directly using curl or from your browser's developer console.

### Option A: Using curl

```bash
# Replace these with actual IDs from your database
REQUEST_ID="your-request-id-here"
CREATOR_ID="your-creator-id-here"
QUOTED_AMOUNT=75000

# Get your auth token (logged in user)
# Go to: Application > Local Storage > https://yourapp.com
# Copy the value of: sb-ucbueapoexnxhttynfzy-auth-token
# Extract the access_token from the JSON

curl -X POST \
  "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/notify-dobbletap-quote-decision" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"creator_id\": \"$CREATOR_ID\",
    \"decision\": \"accepted\",
    \"quoted_amount\": $QUOTED_AMOUNT,
    \"reviewed_by\": \"test-user-id\",
    \"reviewed_at\": \"2026-02-09T12:00:00Z\"
  }"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Dobbletap notified of quote decision",
  "webhook_response": "..."
}
```

### Option B: Using Browser Console

1. Open your DTTracker app in the browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Paste this code:

```javascript
// Test webhook function
const testWebhook = async () => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.38.4');

  const supabase = createClient(
    'https://ucbueapoexnxhttynfzy.supabase.co',
    'YOUR_ANON_KEY_HERE'
  );

  // Get a test quote
  const { data: quotes } = await supabase
    .from('creator_request_items')
    .select('request_id, creator_id, quoted_amount_cents')
    .eq('status', 'quoted')
    .limit(1);

  if (!quotes || quotes.length === 0) {
    console.log('No quoted items found');
    return;
  }

  const quote = quotes[0];
  console.log('Testing with quote:', quote);

  // Call webhook function
  const { data, error } = await supabase.functions.invoke('notify-dobbletap-quote-decision', {
    body: {
      request_id: quote.request_id,
      creator_id: quote.creator_id,
      decision: 'accepted',
      quoted_amount: quote.quoted_amount_cents,
      reviewed_by: 'test-user',
      reviewed_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error('Webhook error:', error);
  } else {
    console.log('Webhook success:', data);
  }
};

testWebhook();
```

---

## Test 3: End-to-End UI Test

This tests the complete flow including the RPC function and webhook.

1. Go to `/requests` page
2. Find a quote with status "quoted" (pending)
3. Click **Accept** button
4. Check browser console for logs
5. Verify in database:

```sql
SELECT
  cr.id,
  cr.quote_status,
  cr.quote_reviewed_at,
  cr.quote_reviewed_by,
  cri.status as item_status
FROM creator_requests cr
JOIN creator_request_items cri ON cri.request_id = cr.id
WHERE cr.id = 'YOUR_REQUEST_ID';
```

**Expected Results**:
```
quote_status: 'accepted'        ✅
quote_reviewed_at: <timestamp>  ✅
quote_reviewed_by: <user-uuid>  ✅
item_status: 'approved'         ✅
```

6. Check Edge Function logs:
   - Go to: https://supabase.com/dashboard/project/ucbueapoexnxhttynfzy/functions/notify-dobbletap-quote-decision/logs
   - Look for: "Dobbletap notified successfully"

---

## Test 4: Verify Dobbletap Received Webhook

Check with Dobbletap team that they received:

```json
{
  "eventType": "quote_reviewed",
  "timestamp": "2026-02-09T...",
  "data": {
    "dobble_tap_request_id": "...",
    "dobble_tap_creator_id": "...",
    "decision": "accepted",
    "quoted_amount": 75000,
    "reviewed_at": "2026-02-09T..."
  }
}
```

At their endpoint:
```
https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e/webhooks/dttracker/quote-decision
```

---

## Troubleshooting

### 401 Unauthorized
- Make sure you're logged in
- Check that your JWT token is valid
- Try refreshing the page and testing again

### 404 Not Found (Request/Creator)
- Verify the request_id and creator_id exist in the database
- Check that the creator has a `dobble_tap_user_id`
- Check that the request has a `dobble_tap_request_id`

### Webhook notification failed
- Check Edge Function logs for details
- Verify SYNC_API_KEY is set correctly
- Confirm Dobbletap endpoint is accessible

### Quote status not updating
- Verify RPC function was updated (run BACKEND_TEST.sql)
- Check RLS policies allow the update
- Look for errors in browser console

---

## Success Criteria

All tests pass when:
- ✅ RPC function updates both tables correctly
- ✅ Webhook function accepts JWT authentication
- ✅ Webhook successfully sends to Dobbletap
- ✅ No inconsistent data remains in database
- ✅ UI shows correct statuses after accepting/rejecting
- ✅ Dobbletap confirms they received the webhook
