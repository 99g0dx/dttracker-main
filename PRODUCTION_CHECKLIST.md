# DTTracker - Production Setup Checklist

Use this checklist to ensure you've completed all steps for production deployment.

---

## Phase 1: Account Setup

### Accounts Created
- [ ] Supabase account created at https://supabase.com
- [ ] RapidAPI account created at https://rapidapi.com
- [ ] Google Cloud account created at https://console.cloud.google.com
- [ ] Vercel/Netlify account created (for hosting)
- [ ] Domain registrar account (optional, for custom domain)

### Credentials Saved Securely
- [ ] Password manager installed (1Password, Bitwarden, LastPass)
- [ ] Supabase database password saved
- [ ] RapidAPI key saved
- [ ] YouTube API key saved
- [ ] All credentials stored in password manager (NOT in code)

---

## Phase 2: Supabase Configuration

### Project Setup
- [ ] Production Supabase project created
- [ ] Project name set to `dttracker-production` (or custom name)
- [ ] Region selected (closest to target users)
- [ ] Database password generated and saved
- [ ] Project provisioned successfully (~2 min wait)

### Credentials Retrieved
- [ ] `SUPABASE_URL` copied from Settings → API
- [ ] `SUPABASE_ANON_KEY` copied from Settings → API
- [ ] `SUPABASE_SERVICE_ROLE_KEY` copied from Settings → API
- [ ] All keys saved in password manager

### Database Schema
- [ ] `database/schema.sql` file exists in project
- [ ] SQL Editor opened in Supabase Dashboard
- [ ] Schema pasted and executed
- [ ] Success message confirmed: "Success. No rows returned"
- [ ] Tables verified in Table Editor:
  - [ ] `campaigns` table exists
  - [ ] `creators` table exists
  - [ ] `posts` table exists
  - [ ] `post_metrics` table exists
  - [ ] `campaign_members` table exists

### Row Level Security (RLS)
- [ ] Test user created in Authentication → Users
- [ ] RLS test query executed successfully
- [ ] Verified query returns 0 rows for new user (RLS working)

### Storage Configuration
- [ ] Storage section opened
- [ ] `campaign-covers` bucket created
- [ ] Bucket set to **Public**
- [ ] Policies verified:
  - [ ] "Authenticated users can upload campaign covers" exists
  - [ ] "Anyone can view campaign covers" exists

---

## Phase 3: API Keys Acquisition

### RapidAPI Setup
- [ ] RapidAPI account verified (email confirmed)
- [ ] Navigated to TikTok Video No Watermark API
- [ ] Subscribed to appropriate plan:
  - [ ] Free tier (50 requests/month) for testing
  - [ ] Pro tier ($10/month, 1,000 requests) for production
- [ ] Navigated to Instagram Scraper API2
- [ ] Subscribed to appropriate plan:
  - [ ] Free tier (50 requests/month) for testing
  - [ ] Pro tier ($15/month, 1,000 requests) for production
- [ ] RapidAPI key copied from https://rapidapi.com/developer/security
- [ ] Key saved in password manager

### YouTube API Setup
- [ ] Google Cloud project created (`DTTracker`)
- [ ] YouTube Data API v3 enabled
- [ ] API key created in Credentials
- [ ] YouTube API key copied immediately
- [ ] Key saved in password manager
- [ ] API key restrictions configured:
  - [ ] HTTP referrers restriction added
  - [ ] Production domain added: `https://yourdomain.com/*`
  - [ ] Supabase domain added: `https://*.supabase.co/*`
  - [ ] API restriction set to "YouTube Data API v3" only
  - [ ] Restrictions saved

---

## Phase 4: Edge Function Deployment

### CLI Setup
- [ ] Supabase CLI installed (brew/scoop/npm)
- [ ] CLI version verified: `supabase --version`
- [ ] Logged in to Supabase: `supabase login`
- [ ] Browser authentication completed

### Project Linking
- [ ] Project reference ID copied from Supabase dashboard URL
- [ ] Navigated to project directory in terminal
- [ ] Project linked: `supabase link --project-ref xxxxx`
- [ ] Database password entered
- [ ] Link successful message confirmed

### Environment Variables
- [ ] RapidAPI key set as secret:
  ```bash
  supabase secrets set RAPIDAPI_KEY=your_key_here
  ```
- [ ] YouTube API key set as secret:
  ```bash
  supabase secrets set YOUTUBE_API_KEY=your_key_here
  ```
- [ ] Secrets verified: `supabase secrets list`
- [ ] Both secrets appear in list

### Function Deployment
- [ ] Edge function deployed:
  ```bash
  supabase functions deploy scrape-post --no-verify-jwt
  ```
- [ ] Deployment successful message confirmed
- [ ] Function URL copied and saved
- [ ] Test cURL command executed successfully
- [ ] Response received with metrics data

---

## Phase 5: Frontend Configuration

### Environment Variables
- [ ] `.env.local` file created in project root
- [ ] `VITE_SUPABASE_URL` added to `.env.local`
- [ ] `VITE_SUPABASE_ANON_KEY` added to `.env.local`
- [ ] `.env.local` added to `.gitignore` (verify)
- [ ] `.gitignore` verified to exclude environment files

### Supabase Client
- [ ] `src/lib/supabase.ts` exists
- [ ] Client configured to read from environment variables
- [ ] Error handling for missing variables implemented

### Build & Test
- [ ] Dependencies installed: `npm install`
- [ ] Production build successful: `npm run build`
- [ ] No build errors or TypeScript errors
- [ ] Preview build locally: `npm run preview`
- [ ] Preview opens at http://localhost:4173
- [ ] Basic functionality tested in preview

---

## Phase 6: Deployment

### Hosting Platform Setup
- [ ] Vercel/Netlify CLI installed
- [ ] Logged in to hosting platform
- [ ] Production deployment initiated
- [ ] Deployment successful
- [ ] Production URL received and saved

### Environment Variables (Hosting)
- [ ] Navigated to hosting dashboard
- [ ] Project settings opened
- [ ] Environment variables added:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Environment variables saved
- [ ] Project redeployed with new variables

### Custom Domain (Optional)
- [ ] Custom domain purchased/available
- [ ] Domain added in hosting dashboard
- [ ] DNS records updated at registrar
- [ ] SSL certificate provisioned (5-10 min wait)
- [ ] HTTPS working on custom domain

---

## Phase 7: Post-Deployment Configuration

### Authentication URLs
- [ ] Supabase Dashboard → Authentication → URL Configuration opened
- [ ] **Site URL** updated to production domain
- [ ] **Redirect URLs** added:
  - [ ] `https://yourdomain.com/**`
  - [ ] `https://yourdomain.com/auth/callback`
- [ ] Settings saved

### Email Templates (Optional)
- [ ] Email templates reviewed in Authentication → Email Templates
- [ ] Templates customized (if desired):
  - [ ] Confirm signup
  - [ ] Magic Link
  - [ ] Change Email Address
  - [ ] Reset Password
- [ ] Templates saved

---

## Phase 8: Monitoring Setup

### Supabase Monitoring
- [ ] Database logs reviewed (Database → Logs)
- [ ] Edge Function logs reviewed (Edge Functions → Logs)
- [ ] Storage usage checked (Storage → Usage)
- [ ] Baseline metrics noted

### RapidAPI Monitoring
- [ ] Usage dashboard opened: https://rapidapi.com/developer/billing
- [ ] Current usage for TikTok API noted
- [ ] Current usage for Instagram API noted
- [ ] Usage alerts configured:
  - [ ] Alert threshold set at 80% of monthly quota
  - [ ] Email notification added
  - [ ] Alert saved

### YouTube API Monitoring
- [ ] Quota dashboard opened: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
- [ ] Current quota usage noted
- [ ] Quota alert created:
  - [ ] Threshold set at 8,000 requests/day (80% of limit)
  - [ ] Notification email added
  - [ ] Alert saved

---

## Phase 9: Production Testing

### Test Account Creation
- [ ] Production URL opened in browser
- [ ] New account created with test email
- [ ] Verification email received
- [ ] Email verified successfully
- [ ] Login successful

### Campaign Creation Test
- [ ] "Create Campaign" button clicked
- [ ] Campaign name entered: "Test Campaign"
- [ ] Brand name entered: "Test Brand"
- [ ] Cover image uploaded (< 5MB)
- [ ] Image preview displayed correctly
- [ ] Start date selected
- [ ] End date selected
- [ ] Notes added
- [ ] "Create Campaign" submitted
- [ ] Redirected to campaign detail page
- [ ] Campaign appears in campaigns list

### CSV Import Test
- [ ] `example-posts.csv` downloaded
- [ ] "Import CSV" button clicked in campaign detail
- [ ] CSV file selected
- [ ] Import progress indicator shown
- [ ] Import completed successfully
- [ ] Success message displayed (X posts imported)
- [ ] Posts appear in campaign posts table
- [ ] Post count correct (20 posts from example CSV)

### Scraping Test
- [ ] "Scrape All Posts" button clicked
- [ ] Confirmation dialog accepted
- [ ] Scraping progress shown
- [ ] Scraping completed (wait ~40 seconds for 20 posts @ 2s each)
- [ ] Success toast notification shown
- [ ] Post metrics updated:
  - [ ] Views populated
  - [ ] Likes populated
  - [ ] Comments populated
  - [ ] Shares populated (TikTok/YouTube)
  - [ ] Engagement rate calculated
- [ ] `last_scraped_at` timestamp shown
- [ ] Charts updated with new data

### Individual Platform Scraping
- [ ] TikTok post scraped successfully
- [ ] Instagram post scraped successfully
- [ ] YouTube post scraped successfully
- [ ] Metrics match expected ranges
- [ ] No errors in console

### CSV Export Test
- [ ] "Export CSV" button clicked
- [ ] File downloaded successfully
- [ ] Filename format correct: `Campaign_Name_posts_YYYY-MM-DD.csv`
- [ ] CSV opened in spreadsheet software
- [ ] All columns present:
  - [ ] creator_name
  - [ ] creator_handle
  - [ ] platform
  - [ ] post_url
  - [ ] posted_date
  - [ ] views
  - [ ] likes
  - [ ] comments
  - [ ] shares
- [ ] Data matches UI display
- [ ] Scraped metrics included in export

### Campaign Editing Test
- [ ] "Edit Campaign" button clicked
- [ ] Form pre-populated with current data
- [ ] Campaign name updated
- [ ] Cover image replaced (new upload)
- [ ] Dates updated
- [ ] Notes updated
- [ ] "Save Changes" clicked
- [ ] Success toast shown
- [ ] Changes reflected immediately
- [ ] Old cover image deleted from storage (verify in Supabase Storage)

### Post Management Test
- [ ] Single post added manually
- [ ] Post appears in table
- [ ] Post edited (URL changed)
- [ ] Edit saved successfully
- [ ] Post deleted
- [ ] Post removed from table
- [ ] Campaign metrics recalculated

### Campaign Deletion Test
- [ ] New test campaign created
- [ ] Posts added to campaign
- [ ] "Delete Campaign" clicked
- [ ] Confirmation dialog shown
- [ ] Deletion confirmed
- [ ] Campaign removed from list
- [ ] Campaign detail page redirects to campaigns list
- [ ] Posts deleted (verify in Supabase Table Editor)
- [ ] Cover image deleted (verify in Storage)

---

## Phase 10: Error Testing

### Input Validation Errors
- [ ] Attempted to create campaign without name → Error shown
- [ ] Attempted to upload 10MB image → Error shown
- [ ] Attempted to import invalid CSV → Error shown
- [ ] All errors show user-friendly toast notifications
- [ ] No raw error messages exposed to user

### Scraping Errors
- [ ] Attempted to scrape invalid TikTok URL → Error handled gracefully
- [ ] Attempted to scrape private Instagram account → Error handled gracefully
- [ ] Invalid YouTube URL → Error handled gracefully
- [ ] Post status set to 'failed' for failed scrapes
- [ ] Error logged in Edge Function logs

### Security Errors
- [ ] Logged out and attempted to access campaign → Redirected to login
- [ ] Created second user account
- [ ] Attempted to access first user's campaign → Denied (RLS working)
- [ ] Attempted to modify another user's post → Denied (RLS working)

---

## Phase 11: Performance Testing

### Lighthouse Audit
- [ ] Chrome DevTools opened (F12)
- [ ] Lighthouse tab selected
- [ ] Mobile audit run
- [ ] Desktop audit run
- [ ] Scores reviewed:
  - [ ] Performance: > 90
  - [ ] Accessibility: > 90
  - [ ] Best Practices: > 90
  - [ ] SEO: > 90

### Load Testing
- [ ] Large campaign tested (100+ posts)
- [ ] CSV import tested with 100+ rows
- [ ] Bulk scraping tested (20+ posts)
- [ ] Page load times acceptable (< 3 seconds)
- [ ] No browser crashes or freezes

### Mobile Testing
- [ ] Tested on iPhone (Safari)
- [ ] Tested on Android (Chrome)
- [ ] Responsive design working correctly
- [ ] Touch interactions working
- [ ] No horizontal scrolling
- [ ] Buttons sized appropriately for touch

### Browser Compatibility
- [ ] Tested in Chrome (desktop)
- [ ] Tested in Safari (desktop)
- [ ] Tested in Firefox (desktop)
- [ ] Tested in Edge (desktop)
- [ ] No browser-specific issues found

---

## Phase 12: Documentation

### User Documentation
- [ ] User guide created (optional)
- [ ] Screenshots added for key features
- [ ] Video tutorial recorded (optional)
- [ ] FAQ document created

### Developer Documentation
- [ ] README.md updated with production setup
- [ ] API endpoints documented
- [ ] Database schema documented
- [ ] Environment variables listed

### Legal Documents
- [ ] Terms of Service drafted
- [ ] Privacy Policy drafted
- [ ] Cookie Policy added (if using cookies)
- [ ] GDPR compliance reviewed (if EU users)
- [ ] Legal pages added to footer

---

## Phase 13: Business Setup

### Support Infrastructure
- [ ] Support email created (e.g., support@yourdomain.com)
- [ ] Support email forwarding configured
- [ ] Auto-reply message configured
- [ ] Support ticket system setup (optional - Zendesk, Intercom)

### Analytics (Optional)
- [ ] Google Analytics installed
- [ ] Tracking code added to app
- [ ] Goals configured (signup, create campaign, scrape)
- [ ] Conversion tracking setup

### Error Tracking (Optional)
- [ ] Sentry account created
- [ ] Sentry SDK installed
- [ ] Error reporting tested
- [ ] Alerts configured

---

## Phase 14: Pre-Launch Final Checks

### Security Audit
- [ ] All API keys in Supabase secrets (not in code)
- [ ] `.env.local` not committed to Git
- [ ] RLS policies tested with multiple users
- [ ] YouTube API key restricted to specific domains
- [ ] HTTPS enabled on all pages
- [ ] No sensitive data in client-side code
- [ ] No console.log statements in production build

### Cost Review
- [ ] Supabase plan confirmed (Free or Pro)
- [ ] RapidAPI subscriptions confirmed:
  - [ ] TikTok API: $___/month
  - [ ] Instagram API: $___/month
- [ ] YouTube API quota confirmed (free up to 10k/day)
- [ ] Hosting plan confirmed (Vercel/Netlify free or paid)
- [ ] Total monthly cost calculated: $___/month
- [ ] Budget approved

### Backup & Recovery
- [ ] Database backup schedule configured in Supabase
- [ ] Storage backup strategy defined
- [ ] Code backed up to GitHub/GitLab
- [ ] Recovery plan documented

---

## Phase 15: Launch

### Soft Launch
- [ ] Invite 5-10 beta users
- [ ] Monitor usage for 48 hours
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Monitor API usage and costs

### Public Launch
- [ ] Public announcement prepared
- [ ] Social media posts scheduled
- [ ] Blog post published (optional)
- [ ] Product Hunt launch (optional)
- [ ] Email list notified (if applicable)

### Post-Launch Monitoring (First 7 Days)
- [ ] Day 1: Check logs hourly
- [ ] Day 2: Check logs every 4 hours
- [ ] Day 3-7: Check logs daily
- [ ] Monitor API usage daily
- [ ] Monitor error rates daily
- [ ] Respond to support emails within 24 hours
- [ ] Track user feedback and feature requests

---

## Phase 16: Post-Launch Optimization

### Week 1 Review
- [ ] Review Supabase logs for errors
- [ ] Review Edge Function logs
- [ ] Check RapidAPI usage vs. quota
- [ ] Check YouTube API usage vs. quota
- [ ] Identify slow database queries
- [ ] Fix critical bugs
- [ ] Respond to all user feedback

### Week 2-4 Improvements
- [ ] Optimize slow queries (add indexes if needed)
- [ ] Reduce API calls (implement caching)
- [ ] Improve error messages based on user feedback
- [ ] Add requested features (prioritize high-impact)
- [ ] Update documentation based on common questions

### Cost Optimization
- [ ] Review actual API usage vs. plan
- [ ] Downgrade/upgrade RapidAPI plans as needed
- [ ] Implement scraping quotas if costs too high
- [ ] Add 24-hour cache for scraped posts
- [ ] Review storage usage and cleanup old files

---

## Success Metrics

After launch, track these metrics weekly:

### User Metrics
- [ ] New signups: ___ per week
- [ ] Active users: ___ per week
- [ ] Campaigns created: ___ per week
- [ ] Posts imported: ___ per week
- [ ] Scrapes performed: ___ per week

### Technical Metrics
- [ ] Average page load time: ___ seconds
- [ ] Error rate: ___% (target < 1%)
- [ ] API success rate: ___% (target > 95%)
- [ ] Uptime: ___% (target > 99.9%)

### Business Metrics
- [ ] Monthly cost: $___ (vs. budget)
- [ ] Cost per user: $___
- [ ] Support tickets: ___ per week
- [ ] User retention: ___% (target > 40%)

---

## Next Steps

After successful production launch:

1. **Phase 8: Advanced Features** (from original plan):
   - [ ] Campaign sharing and collaboration
   - [ ] Loading skeletons
   - [ ] Optimistic updates
   - [ ] Error boundaries
   - [ ] Advanced analytics dashboard

2. **Future Enhancements**:
   - [ ] Twitter/Facebook scraping
   - [ ] Automated scraping schedules
   - [ ] Email reports
   - [ ] Team management
   - [ ] API for third-party integrations
   - [ ] Mobile app (React Native)

---

## Rollback Plan (If Needed)

If critical issues occur after launch:

1. **Immediate Actions**:
   - [ ] Disable new user signups (if necessary)
   - [ ] Post status update to users
   - [ ] Identify root cause in logs

2. **Rollback Steps**:
   - [ ] Revert to previous deployment: `vercel --prod --force` (or equivalent)
   - [ ] Revert database migrations (if applicable)
   - [ ] Notify affected users

3. **Recovery**:
   - [ ] Fix issue in development
   - [ ] Test fix thoroughly
   - [ ] Redeploy to production
   - [ ] Monitor closely

---

## Congratulations! 🎉

You've successfully deployed DTTracker to production!

**Final Checklist:**
- [ ] All items above completed
- [ ] Production URL live and working
- [ ] Users can sign up and use the app
- [ ] Scraping working for TikTok, Instagram, YouTube
- [ ] Monitoring and alerts configured
- [ ] Support infrastructure ready
- [ ] Budget and costs within expectations

**Your app is now live at**: ___________________________

**Next Review Date**: ___________________________

---

**Need Help?**
- Refer to [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed instructions
- Check [SCRAPING_SETUP.md](./SCRAPING_SETUP.md) for scraping troubleshooting
- Review Supabase logs: `supabase functions logs scrape-post`
- Check RapidAPI dashboard: https://rapidapi.com/developer/billing
