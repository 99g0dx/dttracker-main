# DTTracker - Production Deployment Guide

This guide will help you deploy DTTracker to production with real API integration, proper security, and monitoring.

---

## Pre-Deployment Checklist

### ✅ Required Accounts
- [ ] Supabase account (https://supabase.com)
- [ ] RapidAPI account (https://rapidapi.com)
- [ ] Google Cloud account (https://console.cloud.google.com)
- [ ] Domain name (optional, recommended for production)

### ✅ Required API Keys
- [ ] RapidAPI Key (for TikTok & Instagram scraping)
- [ ] YouTube Data API Key (for YouTube scraping)
- [ ] Supabase Project URL and Anon Key

---

## Step 1: Create Production Supabase Project

### 1.1 Create New Project
1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Choose organization (or create new one)
4. Project settings:
   - **Name**: `dttracker-production` (or your preferred name)
   - **Database Password**: Generate strong password (save in password manager)
   - **Region**: Choose closest to your target users
   - **Plan**: Start with Free tier, upgrade as needed
5. Click **"Create new project"** (wait ~2 minutes for provisioning)

### 1.2 Save Project Credentials
Once created, go to **Settings** → **API**:

```bash
# Save these values - you'll need them later
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **NEVER commit these to Git or share publicly**

---

## Step 2: Database Setup

### 2.1 Run Database Schema
1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the entire contents of `database/schema.sql`
4. Click **"Run"** (bottom right)
5. Verify success message: "Success. No rows returned"

### 2.2 Verify Tables Created
Go to **Table Editor** and verify these tables exist:
- `campaigns`
- `creators`
- `posts`
- `post_metrics`
- `campaign_members`

### 2.3 Test Row Level Security (RLS)
1. Go to **Authentication** → **Users**
2. Create a test user manually
3. In SQL Editor, run:
```sql
-- Test RLS policies (should return 0 rows for new user)
SELECT * FROM campaigns;
```
4. RLS is working if query runs without errors

### 2.4 Setup Storage Bucket
1. Go to **Storage**
2. Click **"New bucket"**
3. Bucket name: `campaign-covers`
4. **Public bucket**: Yes (for easy image serving)
5. Click **"Create bucket"**
6. Click on `campaign-covers` bucket
7. Go to **Policies** tab
8. Verify these policies exist (should be auto-created from schema):
   - `Authenticated users can upload campaign covers`
   - `Anyone can view campaign covers`

---

## Step 3: Get Production API Keys

### 3.1 RapidAPI Setup (TikTok & Instagram)

#### A. Create RapidAPI Account
1. Go to https://rapidapi.com
2. Click **"Sign Up"** → Use Google/GitHub for easy access
3. Verify email

#### B. Subscribe to TikTok API
1. Go to https://rapidapi.com/yi005/api/tiktok-video-no-watermark2
2. Click **"Pricing"** tab
3. **For Production Launch:**
   - Choose **Pro Plan** ($10/month, 1,000 requests)
   - Or **Basic Plan** ($0/month, 50 requests) to start
4. Click **"Subscribe"**
5. Enter payment details (required even for free tier)

#### C. Subscribe to Instagram API
1. Go to https://rapidapi.com/rapihub-rapihub-default/api/instagram-scraper-api2
2. Click **"Pricing"** tab
3. **For Production Launch:**
   - Choose **Pro Plan** ($15/month, 1,000 requests)
   - Or **Basic Plan** ($0/month, 50 requests) to start
4. Click **"Subscribe"**

#### D. Get Your RapidAPI Key
1. Go to https://rapidapi.com/developer/security
2. Copy your **Default Application Key**
3. Save it securely:
```bash
RAPIDAPI_KEY=abc123def456ghi789... # Your actual key
```

**Production Recommendation**: Start with free tier, monitor usage in first week, upgrade to Pro if needed.

---

### 3.2 YouTube API Setup

#### A. Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click **"Select a project"** dropdown → **"New Project"**
3. Project name: `DTTracker`
4. Click **"Create"** (wait ~30 seconds)
5. Select the new project from dropdown

#### B. Enable YouTube Data API v3
1. In search bar, type "YouTube Data API v3"
2. Click on **"YouTube Data API v3"**
3. Click **"Enable"** button
4. Wait for API to be enabled (~10 seconds)

#### C. Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the API key immediately:
```bash
YOUTUBE_API_KEY=AIzaSyD... # Your actual key
```

#### D. Restrict API Key (IMPORTANT for security)
1. Click **"Edit API key"** (or the pencil icon)
2. **Application restrictions**:
   - Choose **"HTTP referrers (websites)"**
   - Add your production domain: `https://yourdomain.com/*`
   - Add Supabase Edge Function domain: `https://*.supabase.co/*`
3. **API restrictions**:
   - Choose **"Restrict key"**
   - Select **"YouTube Data API v3"** only
4. Click **"Save"**

**Cost**: Free up to 10,000 requests/day (quota resets at midnight Pacific Time)

---

## Step 4: Deploy Edge Function

### 4.1 Install Supabase CLI

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Windows (PowerShell as Administrator):**
```bash
scoop install supabase
```

**Linux / Alternative (NPM):**
```bash
npm install -g supabase
```

Verify installation:
```bash
supabase --version
# Should output: supabase 1.x.x
```

---

### 4.2 Login to Supabase
```bash
supabase login
```

This will:
1. Open your browser for authentication
2. Ask you to authorize the CLI
3. Return to terminal when complete

---

### 4.3 Link to Production Project

Get your project reference ID:
1. Go to https://supabase.com/dashboard
2. Select your production project
3. Look at the URL: `https://supabase.com/dashboard/project/xxxxxxxxxxxxx`
4. Copy the `xxxxxxxxxxxxx` part (this is your project ref)

Link the CLI:
```bash
cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"

supabase link --project-ref xxxxxxxxxxxxx
```

Replace `xxxxxxxxxxxxx` with your actual project ref.

You'll be prompted to enter your database password (from Step 1.1).

---

### 4.4 Set Environment Variables (Secrets)

⚠️ **CRITICAL**: These secrets are stored securely in Supabase and NEVER exposed to the client.

```bash
# Set RapidAPI Key (required for TikTok & Instagram)
supabase secrets set RAPIDAPI_KEY=your_actual_rapidapi_key_here

# Set YouTube API Key (required for YouTube)
supabase secrets set YOUTUBE_API_KEY=your_actual_youtube_key_here
```

**Replace** `your_actual_rapidapi_key_here` and `your_actual_youtube_key_here` with the keys you saved in Step 3.

Verify secrets are set:
```bash
supabase secrets list
```

You should see:
```
RAPIDAPI_KEY
YOUTUBE_API_KEY
```

---

### 4.5 Deploy the Edge Function

```bash
supabase functions deploy scrape-post --no-verify-jwt
```

**Expected output:**
```
Deploying Function scrape-post (project ref: xxxxxxxxxxxxx)
Bundled scrape-post in 234ms.
✓ Deployed Function scrape-post in 1.2s
Function URL: https://xxxxxxxxxxxxx.supabase.co/functions/v1/scrape-post
```

**Note**: `--no-verify-jwt` is needed because we're handling authentication manually in the function.

---

### 4.6 Test Edge Function (via CLI)

```bash
# Test TikTok scraping
curl -X POST \
  'https://xxxxxxxxxxxxx.supabase.co/functions/v1/scrape-post' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -d '{
    "postId": "test-id",
    "postUrl": "https://www.tiktok.com/@test/video/123",
    "platform": "tiktok"
  }'
```

Replace:
- `xxxxxxxxxxxxx` with your project ref
- `YOUR_SUPABASE_ANON_KEY` with your actual anon key

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

## Step 5: Configure Frontend Environment

### 5.1 Update Environment Variables

**Create `.env.local` file:**
```bash
# Production Supabase credentials
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANT**:
- Add `.env.local` to `.gitignore` (should already be there)
- NEVER commit API keys to Git
- Use different credentials for development and production

---

### 5.2 Update Supabase Client

Verify `src/lib/supabase.ts` is configured correctly:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

This file should already be configured from earlier phases.

---

## Step 6: Build and Deploy Frontend

### 6.1 Test Production Build Locally

```bash
# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# Preview production build
npm run preview
```

Open http://localhost:4173 and test:
- [ ] User registration and login
- [ ] Create campaign
- [ ] Upload cover image
- [ ] Add posts manually
- [ ] Import CSV (use example-posts.csv)
- [ ] Scrape posts (TikTok, Instagram, YouTube)
- [ ] View metrics and charts
- [ ] Export CSV
- [ ] Edit campaign
- [ ] Delete campaign

---

### 6.2 Deploy to Hosting Platform

#### Option A: Vercel (Recommended - Free Tier Available)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy:
```bash
vercel --prod
```

4. Set environment variables in Vercel dashboard:
   - Go to https://vercel.com/dashboard
   - Select your project
   - Go to **Settings** → **Environment Variables**
   - Add:
     - `VITE_SUPABASE_URL` = your production Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your production anon key

5. Redeploy:
```bash
vercel --prod
```

---

#### Option B: Netlify (Alternative - Free Tier Available)

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login:
```bash
netlify login
```

3. Deploy:
```bash
netlify deploy --prod
```

4. Set environment variables:
```bash
netlify env:set VITE_SUPABASE_URL "https://xxxxxxxxxxxxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

#### Option C: Supabase Hosting (Coming Soon)

Supabase is rolling out native hosting. Check https://supabase.com/docs/guides/hosting for latest updates.

---

## Step 7: Post-Deployment Configuration

### 7.1 Update Authentication Settings

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add your production domain to **Site URL**:
   - `https://yourdomain.com`
3. Add to **Redirect URLs**:
   - `https://yourdomain.com/**`
   - `https://yourdomain.com/auth/callback`
4. Click **"Save"**

---

### 7.2 Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup** - Welcome email
   - **Magic Link** - Passwordless login
   - **Change Email Address** - Email change confirmation
   - **Reset Password** - Password reset link
3. Update sender email (requires custom domain on paid plan)

---

### 7.3 Setup Custom Domain (Optional)

1. Go to **Project Settings** → **Custom Domains**
2. Add your domain: `yourdomain.com`
3. Update DNS records at your domain registrar
4. Wait for SSL certificate provisioning (~5-10 minutes)

---

## Step 8: Monitoring & Analytics

### 8.1 Enable Supabase Monitoring

1. Go to **Database** → **Logs**
   - Monitor slow queries
   - Track errors
2. Go to **Edge Functions** → **Logs**
   - Monitor scraping errors
   - Track API usage
3. Go to **Storage** → **Usage**
   - Monitor storage usage
   - Track bandwidth

---

### 8.2 Setup RapidAPI Monitoring

1. Go to https://rapidapi.com/developer/billing
2. Monitor usage for:
   - **TikTok Video No Watermark API**
   - **Instagram Scraper API2**
3. Set up alerts:
   - Click **"Usage Alerts"**
   - Set threshold at 80% of monthly quota
   - Add your email

---

### 8.3 Setup YouTube API Monitoring

1. Go to https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. Monitor daily quota usage
3. Set up quota alerts:
   - Click **"Create Alert"**
   - Set threshold at 8,000 requests/day (80% of 10k limit)
   - Add notification email

---

## Step 9: Cost Management

### 9.1 Projected Monthly Costs (Production Launch)

**Supabase:**
- **Free Tier**: $0/month
  - 500 MB database storage
  - 1 GB file storage
  - 2 GB bandwidth
  - 50,000 monthly active users
- **Pro Tier**: $25/month (upgrade when you exceed free tier limits)

**RapidAPI:**
- **TikTok API (Pro Plan)**: $10/month (1,000 requests)
- **Instagram API (Pro Plan)**: $15/month (1,000 requests)
- **Total**: $25/month

**YouTube API:**
- **Free**: $0/month (up to 10,000 requests/day)

**Hosting (Vercel/Netlify):**
- **Free Tier**: $0/month (sufficient for small-medium traffic)

**TOTAL ESTIMATED COST**: $25-50/month for initial launch

---

### 9.2 Cost Optimization Tips

1. **Implement scraping quotas per user**:
   - Free users: 10 scrapes/day
   - Paid users: Unlimited scrapes

2. **Cache scraping results**:
   - Don't scrape same post twice within 24 hours
   - Check `last_scraped_at` timestamp before scraping

3. **Batch scraping**:
   - User clicks "Scrape All" once, not per-post
   - Reduces UI-triggered API calls

4. **Use mock data for demos**:
   - Create demo campaigns with pre-populated data
   - Avoid scraping for onboarding flows

5. **Monitor and alert**:
   - Set up billing alerts at 50%, 80%, 100% thresholds
   - Review usage weekly in early stages

---

## Step 10: Security Checklist

### ✅ Pre-Launch Security Review

- [ ] **Row Level Security (RLS)** enabled on all tables
- [ ] **API keys** stored in Supabase secrets (not in code)
- [ ] **Environment variables** in `.env.local` (not committed to Git)
- [ ] **YouTube API key** restricted to specific domains
- [ ] **HTTPS** enabled on production domain
- [ ] **Supabase Auth** configured with production URLs
- [ ] **CORS headers** configured in Edge Function
- [ ] **Service Role Key** NEVER exposed to client
- [ ] **User authentication** required for all API calls
- [ ] **Input validation** in Edge Function (URL format, platform enum)
- [ ] **Rate limiting** implemented (2s between scrapes)
- [ ] **Error messages** don't expose sensitive info

---

## Step 11: Testing in Production

### 11.1 Create Test Account

1. Go to your production URL
2. Click **"Sign Up"**
3. Use a test email: `test@yourdomain.com`
4. Verify email
5. Login

---

### 11.2 End-to-End Test Flow

**Test 1: Campaign Creation**
- [ ] Create campaign "Test Campaign"
- [ ] Upload cover image (< 5MB)
- [ ] Verify image appears
- [ ] Add brand name "Test Brand"
- [ ] Add start/end dates
- [ ] Add notes
- [ ] Click "Create Campaign"
- [ ] Verify redirect to campaign detail

**Test 2: CSV Import**
- [ ] Download `example-posts.csv`
- [ ] Click "Import CSV" button
- [ ] Select file
- [ ] Verify import progress indicator
- [ ] Verify success message (X posts imported)
- [ ] Verify posts appear in table
- [ ] Check for any error messages

**Test 3: Scraping**
- [ ] Click "Scrape All Posts" button
- [ ] Verify scraping progress indicator
- [ ] Wait for completion (2s per post)
- [ ] Verify metrics update (views, likes, comments, shares)
- [ ] Check `last_scraped_at` timestamp
- [ ] Verify engagement rate calculation
- [ ] Check charts update with new data

**Test 4: CSV Export**
- [ ] Click "Export CSV" button
- [ ] Verify file downloads
- [ ] Open CSV in Excel/Numbers
- [ ] Verify all data is present and accurate
- [ ] Check filename format: `Campaign_Name_posts_2024-01-15.csv`

**Test 5: Campaign Editing**
- [ ] Click "Edit Campaign" button
- [ ] Update campaign name
- [ ] Replace cover image
- [ ] Update dates
- [ ] Click "Save Changes"
- [ ] Verify changes appear immediately
- [ ] Verify old cover image deleted from storage

**Test 6: Post Management**
- [ ] Add single post manually
- [ ] Edit post URL
- [ ] Delete post
- [ ] Verify post count updates
- [ ] Verify metrics recalculate

**Test 7: Campaign Deletion**
- [ ] Create a test campaign
- [ ] Add some posts
- [ ] Click "Delete Campaign"
- [ ] Confirm deletion
- [ ] Verify campaign removed from list
- [ ] Verify posts deleted (cascade delete)
- [ ] Verify cover image deleted from storage

---

### 11.3 Error Testing

**Test Error Handling:**
- [ ] Try to scrape invalid TikTok URL
- [ ] Try to scrape private Instagram account
- [ ] Try to import CSV with invalid data
- [ ] Try to upload 10MB image (should fail)
- [ ] Try to create campaign without required fields
- [ ] Try to access another user's campaign (should fail with RLS)

**Expected behavior**: All errors should show user-friendly toast notifications, no console errors exposed to user.

---

## Step 12: Launch Checklist

### ✅ Final Pre-Launch Checklist

**Technical:**
- [ ] Database schema deployed
- [ ] RLS policies tested
- [ ] Storage bucket configured
- [ ] Edge Function deployed
- [ ] API keys configured
- [ ] Frontend deployed
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active

**Testing:**
- [ ] All user flows tested in production
- [ ] Error handling tested
- [ ] Mobile responsiveness tested
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Performance testing (Lighthouse score > 90)

**Monitoring:**
- [ ] Supabase monitoring enabled
- [ ] RapidAPI usage alerts configured
- [ ] YouTube API quota alerts configured
- [ ] Error tracking setup (Sentry/LogRocket optional)

**Documentation:**
- [ ] User guide created (optional)
- [ ] API documentation (if exposing APIs)
- [ ] Team onboarding docs (if multiple users)

**Business:**
- [ ] Pricing plan decided (free/paid tiers)
- [ ] Terms of Service created
- [ ] Privacy Policy created
- [ ] Support email setup

---

## Troubleshooting

### Edge Function Not Working

**Symptom**: Scraping fails with "Failed to scrape post" error

**Diagnosis**:
```bash
# Check Edge Function logs
supabase functions logs scrape-post --limit 50
```

**Common Issues**:
1. **API keys not set**: Run `supabase secrets list` to verify
2. **Invalid API key**: Test keys directly in RapidAPI dashboard
3. **Rate limit exceeded**: Check RapidAPI usage dashboard
4. **Invalid URL format**: Verify post URL matches expected format

---

### RLS Blocking Queries

**Symptom**: "new row violates row-level security policy" error

**Diagnosis**:
```sql
-- Check if user is authenticated
SELECT auth.uid(); -- Should return UUID, not null

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'campaigns';
```

**Fix**: Ensure user is logged in and policy allows INSERT for authenticated users.

---

### Storage Upload Failing

**Symptom**: "Failed to upload image" error

**Diagnosis**:
1. Check storage bucket exists: Go to **Storage** in Supabase Dashboard
2. Check bucket is public
3. Check file size < 5MB
4. Check file type is `image/*`

**Fix**: Verify storage policies in `database/schema.sql` are applied.

---

### High API Costs

**Symptom**: RapidAPI bill higher than expected

**Diagnosis**:
1. Go to https://rapidapi.com/developer/billing
2. Check **Usage** tab for breakdown
3. Identify which API is over-limit

**Fix**:
1. Implement per-user scraping quotas
2. Add 24-hour cache for scraped posts
3. Upgrade to higher tier if legitimate usage
4. Investigate potential abuse (multiple scrapes of same post)

---

## Support Resources

**Supabase:**
- Documentation: https://supabase.com/docs
- Discord: https://discord.supabase.com
- Support: support@supabase.io

**RapidAPI:**
- Documentation: https://docs.rapidapi.com
- Support: https://rapidapi.com/support

**YouTube API:**
- Documentation: https://developers.google.com/youtube/v3
- Support: https://support.google.com/youtube

---

## Next Steps After Launch

1. **Monitor for 1 week**:
   - Check logs daily
   - Monitor API usage
   - Track user feedback

2. **Gather user feedback**:
   - Add feedback form
   - Monitor support emails
   - Track feature requests

3. **Optimize based on data**:
   - Identify slow queries
   - Optimize database indexes
   - Reduce API calls where possible

4. **Plan Phase 8**:
   - Campaign sharing
   - Loading skeletons
   - Optimistic updates
   - Error boundaries

---

## Congratulations! 🎉

Your DTTracker application is now live in production with:
- ✅ Real-time social media scraping (TikTok, Instagram, YouTube)
- ✅ CSV import/export
- ✅ Secure database with RLS
- ✅ File uploads to cloud storage
- ✅ Production-ready infrastructure
- ✅ Cost-effective API usage

**Estimated setup time**: 2-3 hours for first-time deployment

**Monthly cost**: $25-50 (scales with usage)

**Next milestone**: Phase 8 - Advanced features & polish
