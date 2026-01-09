# DTTracker - Quick Production Setup

Your RapidAPI key is ready! Let's get your app deployed in production.

## 🔑 Your API Key (Already Configured)

```
RapidAPI Key: ca953321a4msh6c804295f3b39e4p16e53fjsn74acdf55b219
```

This key works for:
- ✅ TikTok Video No Watermark API
- ✅ Instagram Scraper API2
- ✅ Twitter/X API (if subscribed)

---

## ⚡ Quick Deployment (5 Minutes)

### Option A: Automated Script (Recommended)

Run the automated deployment script:

```bash
cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"
./deploy.sh
```

The script will:
1. Login to Supabase
2. Link to your project
3. Configure API keys automatically
4. Deploy the Edge Function

---

### Option B: Manual Steps

If you prefer manual control, follow these steps:

#### 1. Login to Supabase

```bash
supabase login
```

This will open your browser for authentication.

---

#### 2. Link to Your Project

First, get your project reference ID:
- Go to https://supabase.com/dashboard
- Select your project
- Copy the project ref from the URL: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`

Then link:

```bash
cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"
supabase link --project-ref YOUR-PROJECT-REF
```

Replace `YOUR-PROJECT-REF` with your actual project reference.

---

#### 3. Configure API Keys

Set your RapidAPI key:

```bash
supabase secrets set RAPIDAPI_KEY=ca953321a4msh6c804295f3b39e4p16e53fjsn74acdf55b219
```

(Optional) Set YouTube API key if you have one:

```bash
supabase secrets set YOUTUBE_API_KEY=your_youtube_key_here
```

**Don't have a YouTube key?** No problem! YouTube scraping will use mock data until you add one. Get a free key here:
- https://console.cloud.google.com/apis/credentials

---

#### 4. Verify Secrets

Check that your secrets are configured:

```bash
supabase secrets list
```

You should see:
```
RAPIDAPI_KEY
YOUTUBE_API_KEY (if you set it)
```

---

#### 5. Deploy Edge Function

```bash
supabase functions deploy scrape-post --no-verify-jwt
```

Expected output:
```
Deploying Function scrape-post (project ref: xxxxxxxxxxxxx)
Bundled scrape-post in 234ms.
✓ Deployed Function scrape-post in 1.2s
Function URL: https://xxxxxxxxxxxxx.supabase.co/functions/v1/scrape-post
```

---

## 🧪 Test Your Deployment

### Test 1: Check Secrets

```bash
supabase secrets list
```

Should show your configured API keys.

---

### Test 2: Test Edge Function (TikTok)

Replace `YOUR_SUPABASE_URL` and `YOUR_ANON_KEY` with your actual values:

```bash
curl -X POST \
  'YOUR_SUPABASE_URL/functions/v1/scrape-post' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "postId": "test-id",
    "postUrl": "https://www.tiktok.com/@charlidamelio/video/7234567890123",
    "platform": "tiktok"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "metrics": {
    "views": 125000,
    "likes": 8500,
    "comments": 450,
    "shares": 320,
    "engagement_rate": 7.42
  }
}
```

---

### Test 3: Check Edge Function Logs

```bash
supabase functions logs scrape-post --limit 20
```

This will show recent scraping activity and any errors.

---

## 📊 Verify Your RapidAPI Subscriptions

Before going live, make sure you're subscribed to the necessary APIs:

### 1. Check TikTok API Subscription

1. Go to https://rapidapi.com/yi005/api/tiktok-video-no-watermark2
2. Check your current plan:
   - **Basic (Free)**: 50 requests/month
   - **Pro ($10/month)**: 1,000 requests/month
   - **Ultra ($30/month)**: 10,000 requests/month

### 2. Check Instagram API Subscription

1. Go to https://rapidapi.com/rapihub-rapihub-default/api/instagram-scraper-api2
2. Check your current plan:
   - **Basic (Free)**: 50 requests/month
   - **Pro ($15/month)**: 1,000 requests/month
   - **Ultra ($50/month)**: 10,000 requests/month

### 3. Recommended for Production Launch

For a production launch with moderate traffic:

- **TikTok API**: Pro Plan ($10/month, 1,000 requests)
- **Instagram API**: Pro Plan ($15/month, 1,000 requests)
- **Total**: $25/month

You can start with the free tier and upgrade when you hit limits.

---

## 🚀 Frontend Deployment

After Edge Function is deployed, configure your frontend:

### 1. Create `.env.local`

In your project root, create `.env.local`:

```bash
# Get these from Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 2. Test Locally

```bash
npm install
npm run build
npm run preview
```

Open http://localhost:4173 and test:
- Create campaign
- Import CSV (use `example-posts.csv`)
- Scrape posts (should fetch real data now!)

---

### 3. Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

In Vercel dashboard, add environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then redeploy:
```bash
vercel --prod
```

---

## 💰 Cost Monitoring

### RapidAPI Usage Dashboard

Monitor your API usage:
- https://rapidapi.com/developer/billing

Set up alerts:
1. Click **"Usage Alerts"**
2. Set threshold at 80% of monthly quota
3. Add your email

### YouTube API Quota Dashboard

Monitor YouTube API usage:
- https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas

Free quota: 10,000 requests/day (resets at midnight PST)

---

## 🐛 Troubleshooting

### "RAPIDAPI_KEY not configured" Error

**Solution**: Check secrets are set:
```bash
supabase secrets list
```

If missing, set it again:
```bash
supabase secrets set RAPIDAPI_KEY=ca953321a4msh6c804295f3b39e4p16e53fjsn74acdf55b219
```

---

### "TikTok API error: 429" (Rate Limit)

**Cause**: Exceeded your RapidAPI quota

**Solution**:
1. Check usage at https://rapidapi.com/developer/billing
2. Upgrade to higher plan
3. Or wait until quota resets (monthly)

---

### Edge Function Not Deploying

**Solution**: Check Edge Function logs:
```bash
supabase functions logs scrape-post --limit 50
```

Common issues:
- Missing `supabase/functions/scrape-post/index.ts` file
- Invalid TypeScript syntax
- Missing dependencies

---

### Scraping Returns Mock Data Instead of Real Data

**Cause**: API keys not configured or invalid

**Solution**:
1. Verify secrets: `supabase secrets list`
2. Test API key directly on RapidAPI dashboard
3. Check Edge Function logs for error messages

---

## 📚 Next Steps

After deployment:

1. ✅ Test scraping with real TikTok/Instagram/YouTube posts
2. ✅ Import `example-posts.csv` to test CSV import
3. ✅ Export CSV to verify export functionality
4. ✅ Monitor API usage for first week
5. ✅ Set up error tracking (optional: Sentry)
6. ✅ Add custom domain (optional)

---

## 🎉 You're Ready for Production!

Your DTTracker app is now configured with:
- ✅ Real RapidAPI key for TikTok & Instagram scraping
- ✅ Edge Function ready to deploy
- ✅ Production-ready infrastructure

**Estimated cost**: $0-25/month depending on usage

**Next milestone**: Deploy frontend and go live!

---

## 📖 Additional Resources

- **Full deployment guide**: [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
- **Complete checklist**: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- **Scraping setup**: [SCRAPING_SETUP.md](./SCRAPING_SETUP.md)

---

**Need help?** Check the Edge Function logs:
```bash
supabase functions logs scrape-post
```
