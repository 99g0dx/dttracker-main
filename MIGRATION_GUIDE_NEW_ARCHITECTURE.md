# Migration Guide: New Creator Data Architecture

## Overview

This migration implements a three-table architecture:
1. **`creators`** - Global master table (all creators)
2. **`workspace_creators`** - Junction table (My Network ownership)
3. **`agency_inventory`** - Marketplace table (All Creators)

## Migration Steps

### Step 1: Run Migrations in Order

Go to **Supabase Dashboard → SQL Editor** and run these migrations **in order**:

1. **`database/migrations/create_workspace_creators.sql`**
   - Creates `workspace_creators` table
   - Sets up RLS policies

2. **`database/migrations/create_agency_inventory.sql`**
   - Creates `agency_inventory` table
   - Sets up RLS policies

3. **`database/migrations/update_creators_table_schema.sql`**
   - Adds `created_by_workspace_id` and new fields to `creators`
   - Updates unique constraint to `(platform, handle)`
   - Migrates existing `owner_workspace_id` data

4. **`database/migrations/migrate_to_workspace_creators.sql`**
   - Ensures all existing creators are in `workspace_creators`
   - Safe to run multiple times

### Step 2: Verify Migration

After running migrations, verify:

1. **Check tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('workspace_creators', 'agency_inventory');
   ```

2. **Check workspace_creators has data:**
   ```sql
   SELECT COUNT(*) FROM workspace_creators;
   ```

3. **Check creators table has new columns:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'creators' 
   AND column_name IN ('created_by_workspace_id', 'profile_url', 'display_name');
   ```

### Step 3: Test the Application

1. **My Network tab:**
   - Should show only creators from `workspace_creators`
   - Should show Contact column with email/phone
   - Should NOT show "Request Creator" button

2. **All Creators tab:**
   - Should show only creators from `agency_inventory` (if any exist)
   - Should NOT show Contact column
   - Should show "Request Creator" button

3. **Import CSV:**
   - Should create entries in both `creators` and `workspace_creators`
   - Should NOT add to `agency_inventory`

## Important Notes

- **Existing data**: All existing creators with `created_by_workspace_id` (or `user_id` as fallback) will be migrated to `workspace_creators`
- **Unique constraint**: Creators are now unique by `(platform, handle)` globally, not per user
- **My Network**: Only shows creators in `workspace_creators` for your workspace
- **All Creators**: Only shows creators in `agency_inventory` with `status = 'active'`
- **Contact privacy**: My Network shows contacts, All Creators never shows contacts
- **Field naming**: The spec mentions `followers` and `engagement_rate`, but the codebase uses `follower_count` and `avg_engagement`. This is acceptable and consistent throughout the codebase.
- **Creator handle links**: All creator handles in the Creator Library are clickable links that open the creator's profile in a new tab. This is implemented via the `CreatorHandleLink` component.

## Troubleshooting

### Error: "column creators.owner_workspace_id does not exist"
- This means migration 3 hasn't been run yet
- Run `update_creators_table_schema.sql` first

### Error: "relation workspace_creators does not exist"
- Run `create_workspace_creators.sql` first

### My Network shows no creators
- Check if `workspace_creators` table has data:
  ```sql
  SELECT * FROM workspace_creators WHERE workspace_id = auth.uid();
  ```
- If empty, run `migrate_to_workspace_creators.sql`

### All Creators shows no creators
- This is expected if `agency_inventory` is empty
- Creators must be manually added to `agency_inventory` by admin
- Use the admin API (`src/lib/api/admin.ts`) to harvest creators:
  - `getCreatorsForHarvesting()` - Query creators available for marketplace
  - `addCreatorToMarketplace()` - Add creator to All Creators
  - `updateMarketplaceStatus()` - Pause/activate creators in marketplace

## Admin Harvesting Workflow

### Step 1: Query Creators Available for Harvesting

Use the admin API to find creators that can be added to the marketplace:

```typescript
import { getCreatorsForHarvesting } from '@/lib/api/admin';

const { data: creators, error } = await getCreatorsForHarvesting();
// Returns creators where:
// - created_by_workspace_id IS NOT NULL (introduced by a user)
// - NOT in agency_inventory (not yet in marketplace)
```

### Step 2: Add Creators to Marketplace

When you find a creator you want to add to All Creators:

```typescript
import { addCreatorToMarketplace } from '@/lib/api/admin';

const { data, error } = await addCreatorToMarketplace(
  creatorId,
  defaultRate, // optional
  'USD', // currency, default 'USD'
  ['tag1', 'tag2'] // optional tags
);
```

### Step 3: Manage Marketplace Status

Pause or activate creators in the marketplace:

```typescript
import { updateMarketplaceStatus } from '@/lib/api/admin';

// Pause a creator (hide from All Creators)
await updateMarketplaceStatus(creatorId, 'paused');

// Activate a creator (show in All Creators)
await updateMarketplaceStatus(creatorId, 'active');
```

## Creator Handle Links

All creator handles in the Creator Library are clickable links that open the creator's profile on their platform in a new tab. This is implemented via the `CreatorHandleLink` component which:

- Generates platform-specific URLs (TikTok, Instagram, YouTube, Twitter, Facebook)
- Opens links in a new tab with proper security (`target="_blank"`, `rel="noopener noreferrer"`)
- Handles edge cases gracefully (falls back to plain text if URL generation fails)

The component is used in:
- Mobile creator cards
- Desktop table rows
- Creator view modal
