# Sound Tracking Feature - Manual Test Plan

## Prerequisites

1. Database migration `042_create_sound_tracking_tables.sql` has been run
2. All 4 edge functions are deployed
3. Secrets are configured (RAPIDAPI_KEY, APIFY_API_TOKEN, etc.)
4. Job runner is scheduled (cron or external service)

## Test 1: Create Sound Track from TikTok URL

**Steps:**
1. Navigate to `/sounds`
2. Click "Track a Sound"
3. Paste a TikTok video URL: `https://www.tiktok.com/@username/video/1234567890`
4. Click "Start Tracking"

**Expected Results:**
- Redirects to `/sounds/{soundTrackId}`
- Sound detail page loads
- Shows "Data Pending" banner initially
- Sound title and artist appear (if available)
- Platform icon shows TikTok

## Test 2: Create Sound Track from Instagram Reel

**Steps:**
1. Navigate to `/sounds/new`
2. Paste an Instagram Reel URL: `https://www.instagram.com/reel/ABC123/`
3. Click "Start Tracking"

**Expected Results:**
- Sound track is created
- Redirects to detail page
- Platform icon shows Instagram
- May show "Data Pending" if API is limited

## Test 3: View Sounds List

**Steps:**
1. Navigate to `/sounds`
2. View the list of tracked sounds

**Expected Results:**
- See all sounds for current workspace
- Each sound shows: platform icon, title, artist, use count, last updated
- Search bar filters by title, artist, or URL
- Empty state shows when no sounds exist

## Test 4: View Sound Detail - KPIs

**Steps:**
1. Click on a sound from the list
2. View the KPI cards

**Expected Results:**
- **Total Uses**: Latest snapshot value or "-" if no data
- **24h Change**: Delta from 24 hours ago with percentage
- **7d Change**: Delta from 7 days ago with percentage
- **Velocity**: Uses per hour (24h delta / 24)
- Trend indicators (up/down arrows) show correct direction

## Test 5: View Sound Detail - Chart

**Steps:**
1. On sound detail page, scroll to chart section
2. View the "Uses Over Time" chart

**Expected Results:**
- Line chart displays if snapshots exist
- X-axis shows dates
- Y-axis shows use counts (formatted as K/M/B)
- Tooltip shows exact values on hover
- Chart updates when new snapshots are added

## Test 6: View Top Posts

**Steps:**
1. On sound detail page, ensure "Top Posts" tab is selected
2. View the list of posts

**Expected Results:**
- Posts sorted by views (highest first)
- Each post shows: creator handle, platform icon, views, likes, comments
- Clicking a post opens it in a new tab
- Shows "No posts found yet" if no posts discovered

## Test 7: View Recent Posts

**Steps:**
1. Switch to "Recent Posts" tab
2. View the list of posts

**Expected Results:**
- Posts sorted by creation date (newest first)
- Same post information as Top Posts
- Different ordering than Top Posts

## Test 8: Refresh Sound

**Steps:**
1. On sound detail page, click "Refresh Now" button
2. Wait a few seconds
3. Check for updates

**Expected Results:**
- Toast notification: "Sound refresh started"
- New snapshot appears after job runner processes
- KPIs update with new values
- Chart adds new data point

## Test 9: Job Runner Processing

**Steps:**
1. Create a new sound track
2. Wait 5 minutes (or trigger job runner manually)
3. Check sound detail page

**Expected Results:**
- Jobs are queued in `sound_track_jobs` table
- Job runner processes jobs
- Snapshots are created
- Posts are discovered
- Post metrics are collected

## Test 10: Data Pending State

**Steps:**
1. Create a sound track
2. If API is blocked/limited, verify UI behavior

**Expected Results:**
- "Data Pending" banner appears
- KPIs show "-" for missing data
- Chart doesn't display (no data)
- Posts list shows "No posts found yet"
- User can still refresh manually

## Test 11: Multi-Workspace Isolation

**Steps:**
1. Create sound tracks in Workspace A
2. Switch to Workspace B
3. View sounds list

**Expected Results:**
- Only sounds from current workspace are visible
- Cannot access sounds from other workspaces
- RLS policies prevent cross-workspace access

## Test 12: Error Handling

**Steps:**
1. Try to create sound with invalid URL
2. Try to create sound with unsupported platform

**Expected Results:**
- Clear error message displayed
- Form doesn't submit
- User can correct and retry

## Test 13: Search Functionality

**Steps:**
1. Navigate to `/sounds`
2. Type in search box: part of a sound title
3. Type in search box: part of an artist name
4. Type in search box: part of a URL

**Expected Results:**
- List filters in real-time
- Shows only matching sounds
- Case-insensitive search
- "No sounds match your search" when no results

## Test 14: Mobile Responsiveness

**Steps:**
1. Open app on mobile device or narrow browser window
2. Navigate through all sound tracking pages
3. Test interactions

**Expected Results:**
- Layout adapts to small screens
- Buttons are touch-friendly
- Charts are readable
- Tables scroll horizontally if needed
- Navigation is accessible

## Test 15: Job Retry Logic

**Steps:**
1. Temporarily break an API key
2. Create a sound track
3. Let job runner attempt processing
4. Fix API key
5. Let job runner retry

**Expected Results:**
- Failed jobs are retried with exponential backoff
- Max attempts (5) prevents infinite retries
- Successful retry processes the job
- Failed jobs after max attempts are marked as failed

## Verification Checklist

After running all tests, verify:

- [ ] Database tables exist and have correct structure
- [ ] RLS policies are active and working
- [ ] Edge functions are deployed and accessible
- [ ] Job runner is scheduled and running
- [ ] API keys are configured correctly
- [ ] Frontend routes work correctly
- [ ] Navigation includes "Sound Tracking"
- [ ] All UI components render correctly
- [ ] Error states are handled gracefully
- [ ] Data updates over time as jobs process

## Common Issues & Solutions

### Issue: Jobs not processing
**Solution:** Check job runner is scheduled, verify logs, check for locked jobs

### Issue: No data appearing
**Solution:** Check API keys, verify job runner ran, check edge function logs

### Issue: 401 errors
**Solution:** Verify secrets are set, check authentication token

### Issue: Chart not showing
**Solution:** Ensure snapshots exist, check data format

### Issue: Posts not appearing
**Solution:** Check provider implementation, verify API access, check job logs
