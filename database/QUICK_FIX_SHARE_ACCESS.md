# Quick Fix: Share Link Access Error

## Errors Fixed
1. "Campaign not found" when accessing share links
2. Only one share link allowed per campaign

## Solution

Run **both** SQL scripts in your Supabase SQL Editor:

### Step 1: Create the share links table (if not already done)
Run `database/add_campaign_share_links_table.sql`

### Step 2: Add public access policies
Run `database/add_share_link_public_access.sql`

### Steps:

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `database/add_share_link_public_access.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

This will:
- Allow anonymous users to view campaigns that have valid share links
- Allow anonymous users to view posts for campaigns with share links
- Allow anonymous users to view creators when viewing posts via share links

## Changes Made

1. **Code Changes:**
   - Modified `generateShareLink` to delete any existing share links before creating a new one (only one link per campaign)
   - Updated the modal UI to reflect that there's only one share link

2. **Database Changes:**
   - Added RLS policies to allow public/anonymous access to campaigns, posts, and creators when they have valid share links

After running the script, refresh your application and try accessing a share link again.


