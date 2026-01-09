# Finding the Correct Instagram Endpoint

## Current Error
```
Instagram API error (404): {"message":"Endpoint '\\/get_ig_post_info.php' does not exist"}
```

The endpoint `/get_ig_post_info.php` **does not exist** in the Instagram Scraper Stable API.

## How to Find the Correct Endpoint

### Step 1: Go to Instagram Scraper Stable API Page

1. Go to https://rapidapi.com/hub
2. Search for **"Instagram Scraper Stable API"**
3. Click on it to open the API page

### Step 2: Check Available Endpoints

On the API page, look for:
- **"Endpoints"** section
- **"API Reference"** section
- **"Available Methods"** section
- Or scroll through the documentation

### Step 3: Find Endpoint for Individual Post Metrics

Look for endpoints that:
- Mention **"post"** or **"media"**
- Mention **"info"**, **"details"**, or **"data"**
- Return **likes**, **comments**, **views**, etc.

Possible endpoint names to look for:
- `/get_ig_post.php`
- `/get_post_info.php`
- `/post_info.php`
- `/get_ig_media_info.php`
- `/get_media_info.php`
- `/post/details.php`
- Or similar variations

### Step 4: Test the Endpoint

1. Click on a potential endpoint
2. Use RapidAPI's "Test Endpoint" feature
3. Enter an Instagram post URL (e.g., `https://www.instagram.com/p/ABC123/`)
4. Check the response - does it include:
   - `likes` or `like_count`
   - `comments` or `comment_count`
   - `views` or `view_count`

### Step 5: Share the Correct Endpoint

Once you find it, share:
1. **The endpoint path** (e.g., `/get_ig_post.php`)
2. **The Code Snippet** from RapidAPI (JavaScript/TypeScript)
3. **An example response** showing the metrics

## Quick Check

On the API page, you should see a list of all available endpoints. Look for one that:
- Takes a post URL as input
- Returns post data with metrics

The endpoint you're looking for should be similar to the ones that exist, but for individual posts rather than user tagged posts.

## What We Know Works

- `/get_ig_user_tagged_posts.php` - **This exists** (from your example)
- We need something similar but for **individual posts**

Share the endpoint path once you find it, and I'll update the code!

