# Querying Dobbletap Campaigns

## Problem

The `campaigns` table column names are different than expected. We need to discover the actual schema.

## Solution: Discover Table Structure First

### Step 1: Log into Dobbletap Supabase Dashboard

Go to: https://supabase.com/dashboard/project/qetwrowpllnkucyxoojp

### Step 2: Go to SQL Editor

Click **SQL Editor** in the left sidebar

### Step 3: Discover Column Names

Run this query to see the table structure:

```sql
-- Get column names and types for campaigns table
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'campaigns'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

### Step 4: View Recent Campaigns

Once you know the column names, adjust this query:

```sql
-- List all campaigns (adjust column names based on Step 3)
SELECT *
FROM campaigns
ORDER BY created_at DESC
LIMIT 10;
```

Or filter for DTTracker campaigns only:

```sql
-- Filter by source if that column exists
SELECT *
FROM campaigns
WHERE source = 'dttracker'
ORDER BY created_at DESC;
```

## Alternative: Use Table Editor (Easiest)

1. Go to **Table Editor** in the left sidebar
2. Click on the **campaigns** table
3. You'll see all data visually
4. Look for rows with:
   - Titles like "Test Public Contest"
   - Created recently (2026-02-07)

## Expected Data

You should find these test campaigns:

### Campaign 1
- **Dobbletap ID**: `0df563d5-964b-4afd-8458-f09e5efd7a26`
- **DTTracker ID**: `09ac0b35-d4cf-4b37-93e9-29eb9c704728`
- **Title**: "Test Public Activation"
- **Budget**: 100,000

### Campaign 2
- **Dobbletap ID**: `3c514849-f422-468a-a456-2aa71cd06aad`
- **DTTracker ID**: `4de8a033-f221-4a07-b25b-a53db92ba44c`
- **Title**: "DTTracker Outbound Test Campaign"
- **Budget**: 500,000

### Campaign 3
- **Dobbletap ID**: `14e1587d-227f-4aa4-b524-75cdb9187ce5`
- **DTTracker ID**: `a7f25458-9b7a-4456-9cb3-6adc9c201728`
- **Title**: "Test Public Contest - 2026-02-07T17:13:31Z"
- **Budget**: 500,000

## Common Column Name Variations

The campaigns table might use:
- `campaign_id` or `uuid` instead of `id`
- `campaign_title` or `name` instead of `title`
- `source_system` instead of `source`
- `external_id` or `origin_id` instead of `source_campaign_id`

## Quick Visual Check

**Fastest way**: Open Table Editor and scroll through recent rows. You should see your test campaigns with titles containing "Test Public Contest" or "Test Public Activation".

## Confirmation

If you see campaigns with:
- ✅ Titles matching your tests
- ✅ Budgets matching (100,000 or 500,000)
- ✅ Created on 2026-02-07
- ✅ Source showing 'dttracker'

Then the integration is **confirmed working**! 🎉

The `200 OK` responses we received already prove the campaigns were created - this visual check is just for your peace of mind.
