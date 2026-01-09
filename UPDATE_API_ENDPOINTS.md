# How to Update API Endpoints for Your Subscribed APIs

## Your Subscribed APIs
- **TikTok**: "Tiktok Data Api"
- **Instagram**: "Instagram Scraper Stable API"
- **Twitter**: "API on Twitter"

## Quick Steps

### Step 1: Get API Information from RapidAPI

For each API:

1. Go to https://rapidapi.com/developer/dashboard
2. Find the API in your subscriptions
3. Click on it to open the API page
4. Look for:
   - **Base URL** (e.g., `https://tiktok-data-api.p.rapidapi.com`)
   - **API Host** (e.g., `tiktok-data-api.p.rapidapi.com`)
   - **Endpoint path** (e.g., `/video/info` or `/post/info`)
   - **Request method** (GET or POST)
   - **Required parameters**

### Step 2: Update the Code

Open `supabase/functions/scrape-post/index.ts` and update these constants (around lines 10-30):

```typescript
// TikTok API Configuration
const TIKTOK_API_BASE_URL = "https://YOUR_TIKTOK_API_BASE_URL"; // Replace with actual base URL
const TIKTOK_API_HOST = "YOUR_TIKTOK_API_HOST"; // Replace with actual host
const TIKTOK_API_ENDPOINT = "/YOUR_ENDPOINT"; // Replace with actual endpoint path

// Instagram API Configuration
const INSTAGRAM_API_BASE_URL = "https://YOUR_INSTAGRAM_API_BASE_URL"; // Replace
const INSTAGRAM_API_HOST = "YOUR_INSTAGRAM_API_HOST"; // Replace
const INSTAGRAM_API_ENDPOINT = "/YOUR_ENDPOINT"; // Replace

// Twitter API Configuration
const TWITTER_API_BASE_URL = "https://YOUR_TWITTER_API_BASE_URL"; // Replace
const TWITTER_API_HOST = "YOUR_TWITTER_API_HOST"; // Replace
const TWITTER_API_ENDPOINT = "/YOUR_ENDPOINT"; // Replace
```

### Step 3: Update Request Format

For each API function, you may need to update:

1. **Request Method**: Change `method: "GET"` to `method: "POST"` if needed
2. **Headers**: Add any additional required headers
3. **Parameters**: Update how the URL/postUrl is passed (query params vs body)
4. **Response Parsing**: Update how metrics are extracted from the response

### Step 4: Use RapidAPI Code Snippets

The easiest way is to:

1. Go to each API page on RapidAPI
2. Click **"Code Snippets"**
3. Select **JavaScript** or **TypeScript**
4. Copy the example code
5. Share it with me, and I'll integrate it properly

### Step 5: Test and Deploy

After updating:

1. Deploy the function: `supabase functions deploy scrape-post`
2. Test scraping a post
3. Check Edge Function logs for any errors
4. Adjust based on the actual API response format

## What I Need From You

To help you update the code correctly, please share:

1. **For each API**, go to RapidAPI and:
   - Copy the **Code Snippet** (JavaScript/TypeScript)
   - Or share:
     - Base URL
     - API Host
     - Endpoint path
     - Request method (GET/POST)
     - Example of required parameters

2. **Test the API** on RapidAPI's test console and share:
   - What the request looks like
   - What the response looks like

Once I have this information, I can update the code to work with your exact APIs!

