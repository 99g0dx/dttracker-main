# DTTracker API Setup for Dobble Tap Integration

This guide explains how to configure DTTracker API credentials for Dobble Tap to connect and sync data.

## 📋 Overview

DTTracker exposes API endpoints via Supabase Edge Functions that Dobble Tap can call to:
- Sync creators from Dobble Tap to DTTracker
- Sync creator statistics
- Submit activation submissions

## 🔑 Required Credentials

Dobble Tap needs two pieces of information:
1. **DTTRACKER_API_URL** - The base URL for DTTracker's API endpoints
2. **DTTRACKER_API_KEY** - A secret API key for authentication

---

## Step 1: Get Your DTTracker API URL

Your DTTracker API base URL is:

```
https://ucbueapoexnxhttynfzy.supabase.co/functions/v1
```

**How to find this if you need to verify:**
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your DTTracker project
3. Go to **Settings** → **API**
4. Copy the **Project URL** (e.g., `https://ucbueapoexnxhttynfzy.supabase.co`)
5. Append `/functions/v1` to get the API base URL

**For Dobble Tap configuration:**
- **DTTRACKER_API_URL**: `https://ucbueapoexnxhttynfzy.supabase.co/functions/v1`

---

## Step 2: Generate and Set the API Key

### Option A: Generate a New API Key (Recommended)

Generate a secure random API key (64-character hex string):

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example generated key:**
```
eef05c5d91e3b8a573d06d1c48f793c94f596ead715df04d6b8d9e5c8570913f
```

### Option B: Use an Existing Key

If you already have a `SYNC_API_KEY` set in Supabase, you can use that same key.

---

## Step 3: Set the API Key in Supabase

You need to set the `SYNC_API_KEY` secret in your Supabase Edge Functions:

### Method 1: Using Supabase Dashboard (Easiest)

1. Go to https://app.supabase.com
2. Select your DTTracker project
3. Navigate to **Edge Functions** → **Settings** → **Secrets**
4. Click **Add new secret**
5. Set:
   - **Name**: `SYNC_API_KEY`
   - **Value**: Your generated API key (from Step 2)
6. Click **Save**

### Method 2: Using Supabase CLI

```bash
# Make sure you're logged in and linked to your project
supabase login
supabase link --project-ref ucbueapoexnxhttynfzy

# Set the API key secret
supabase secrets set SYNC_API_KEY=eef05c5d91e3b8a573d06d1c48f793c94f596ead715df04d6b8d9e5c8570913f
```

**Replace the example key with your actual generated key.**

---

## Step 4: Configure in Dobble Tap

In your Dobble Tap system, set these environment variables or configuration:

```
DTTRACKER_API_URL=https://ucbueapoexnxhttynfzy.supabase.co/functions/v1
DTTRACKER_API_KEY=eef05c5d91e3b8a573d06d1c48f793c94f596ead715df04d6b8d9e5c8570913f
```

**Important:** Replace the example API key with the actual key you generated in Step 2.

---

## 📡 Available API Endpoints

Dobble Tap can call these endpoints:

### 1. Sync Creator from Dobble Tap

**Endpoint:** `POST /creator-sync-from-dobbletap`

**Purpose:** Sync a creator from Dobble Tap to DTTracker

**Request Headers:**
```
Authorization: Bearer {DTTRACKER_API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "creator_id": "dobble_tap_user_id",
  "profile_photo": "https://...",
  "bio": "Creator bio",
  "location": "Location",
  "social_accounts": [
    {
      "platform": "tiktok",
      "handle": "@username",
      "followers": 10000,
      "verified_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "creator_id": "dttracker_creator_uuid"
}
```

---

### 2. Sync Creator Statistics

**Endpoint:** `POST /creator-stats-sync-from-dobbletap`

**Purpose:** Update creator statistics after campaign completion

**Request Headers:**
```
Authorization: Bearer {DTTRACKER_API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "creator_id": "dttracker_creator_uuid",
  "activation_id": "activation_uuid",
  "views": 50000,
  "likes": 5000,
  "comments": 500,
  "shares": 200,
  "engagement_rate": 0.114
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 3. Submit Activation Submission

**Endpoint:** `POST /activation-submission-webhook`

**Purpose:** Submit a creator's activation submission from Dobble Tap

**Request Headers:**
```
Authorization: Bearer {DTTRACKER_API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
{
  "activation_id": "activation_uuid",
  "creator_id": "dttracker_creator_uuid",
  "creator_handle": "@username",
  "creator_platform": "tiktok",
  "content_url": "https://...",
  "proof_url": "https://...",
  "proof_comment_text": "Comment text",
  "submitted_at": "2024-01-01T00:00:00Z",
  "payment_amount": 5000,
  "tier": "A",
  "creator_followers": 10000,
  "verification_method": "manual"
}
```

**Response:**
```json
{
  "success": true,
  "submission_id": "submission_uuid",
  "status": "pending"
}
```

---

## 🔒 Security Notes

1. **Keep the API key secret** - Never commit it to version control or expose it publicly
2. **Use HTTPS only** - All API calls must use HTTPS
3. **Rotate keys periodically** - Generate new keys if compromised
4. **Monitor usage** - Check Supabase Edge Function logs for unauthorized access

---

## ✅ Verification

To verify the setup is working:

1. **Check Supabase Secrets:**
   ```bash
   supabase secrets list
   ```
   Should show `SYNC_API_KEY` in the list

2. **Test an API call:**
   ```bash
   curl -X POST https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/creator-sync-from-dobbletap \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "creator_id": "test123",
       "social_accounts": [{
         "platform": "tiktok",
         "handle": "@test",
         "followers": 1000
       }]
     }'
   ```

3. **Check Edge Function Logs:**
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Look for successful API calls

---

## 🐛 Troubleshooting

### Error: "Unauthorized" (401)

**Cause:** API key mismatch or not set

**Solution:**
- Verify `SYNC_API_KEY` is set in Supabase Edge Functions secrets
- Verify Dobble Tap is using the same key
- Check the Authorization header format: `Bearer {key}`

### Error: "Server configuration error" (500)

**Cause:** Missing Supabase configuration

**Solution:**
- Verify `SUPABASE_URL` is set in Edge Functions secrets
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Functions secrets

### Error: "Function not found" (404)

**Cause:** Edge Function not deployed

**Solution:**
- Deploy the Edge Functions:
  ```bash
  supabase functions deploy creator-sync-from-dobbletap
  supabase functions deploy creator-stats-sync-from-dobbletap
  supabase functions deploy activation-submission-webhook
  ```

---

## 📝 Summary

**For Dobble Tap Configuration:**

```
DTTRACKER_API_URL=https://ucbueapoexnxhttynfzy.supabase.co/functions/v1
DTTRACKER_API_KEY=<your-generated-api-key>
```

**Make sure:**
1. ✅ API key is generated and set in Supabase Edge Functions secrets as `SYNC_API_KEY`
2. ✅ Edge Functions are deployed
3. ✅ Dobble Tap has both `DTTRACKER_API_URL` and `DTTRACKER_API_KEY` configured
4. ✅ All API calls use `Authorization: Bearer {DTTRACKER_API_KEY}` header

---

## 📞 Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Verify all secrets are set correctly
3. Test API endpoints individually using curl or Postman
4. Ensure Edge Functions are deployed and up-to-date
