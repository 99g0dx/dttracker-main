# Quick Fix: Campaign Share Links Table

## Error
"Could not find the table 'public.campaign_share_links' in the schema cache"

## Solution

Run the SQL script `database/add_campaign_share_links_table.sql` in your Supabase SQL Editor.

### Steps:

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `database/add_campaign_share_links_table.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

The script will:
- Create the `campaign_share_links` table
- Add necessary indexes
- Enable Row Level Security (RLS)
- Create RLS policies for secure access

After running the script, refresh your application and try creating a share link again.


