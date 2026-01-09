# Finding the Correct Endpoints for Video/Post Metrics

## Current Situation

The curl examples you provided are for different purposes:
- **TikTok**: `/shop/detail-product` - for shop products, not video metrics
- **Instagram**: `/get_ig_user_tagged_posts.php` - for user tagged posts, not individual post metrics
- **Twitter**: `/download` - for downloading content, not tweet metrics

We need endpoints that return **metrics** (views, likes, comments, shares) for individual posts/videos.

## How to Find the Correct Endpoints

### Step 1: Go to Each API Page on RapidAPI

1. **TikTok Data Api**: https://rapidapi.com/hub
   - Search for "Tiktok Data Api"
   - Click on it

2. **Instagram Scraper Stable API**: https://rapidapi.com/hub
   - Search for "Instagram Scraper Stable API"
   - Click on it

3. **API on Twitter**: https://rapidapi.com/hub
   - Search for "API on Twitter"
   - Click on it

### Step 2: Look for Endpoints That Return Metrics

For each API, look for endpoints like:
- **Video/Post Info** - Returns video/post details including metrics
- **Video/Post Statistics** - Returns statistics/metrics
- **Video/Post Details** - Returns detailed info including metrics
- **Get Video/Post** - Returns video/post data with metrics

### Step 3: Check the Response Format

When you find a potential endpoint:
1. Click on it in the API documentation
2. Look at the **Response** section
3. Check if it includes:
   - Views/view_count/play_count
   - Likes/like_count
   - Comments/comment_count
   - Shares/share_count/retweets

### Step 4: Test the Endpoint

1. Use RapidAPI's "Test Endpoint" feature
2. Enter a real post/video URL
3. See what the response looks like
4. Verify it has the metrics we need

## What to Share

Once you find the correct endpoints, share:

1. **TikTok endpoint** that returns video metrics:
   - Endpoint path (e.g., `/video/info` or `/video/details`)
   - Method (GET or POST)
   - Required parameters
   - Example response showing metrics

2. **Instagram endpoint** that returns post metrics:
   - Endpoint path (e.g., `/get_ig_post_info.php` or `/post/info`)
   - Method (GET or POST)
   - Required parameters
   - Example response showing metrics

3. **Twitter endpoint** that returns tweet metrics:
   - Endpoint path (e.g., `/tweet/info` or `/status/info`)
   - Method (GET or POST)
   - Required parameters
   - Example response showing metrics

## Alternative: Share Code Snippets

For each API:
1. Go to the API page
2. Find the endpoint that returns post/video metrics
3. Click "Code Snippets"
4. Select JavaScript/TypeScript
5. Copy the code snippet
6. Share it here

I'll integrate it into the Edge Function!

## Quick Check

On each API page, look for sections like:
- **Endpoints** or **API Reference**
- **Available Endpoints**
- **Methods**

Then look for endpoints with names like:
- "Get Video Info"
- "Get Post Details"
- "Video Statistics"
- "Post Metrics"
- "Tweet Info"
- etc.

These are likely the ones we need!

