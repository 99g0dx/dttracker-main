# Create team_invites Table in Supabase

## Quick Fix

The app is looking for `public.team_invites` table that doesn't exist in your database.

## Solution

### Option 1: Run the Complete Schema (Recommended)

If you haven't run the full schema yet, run the entire `database/schema.sql` file:
1. Go to **Supabase Dashboard → SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `database/schema.sql`
4. Click **Run**

This will create all tables including `team_invites` with proper RLS policies.

### Option 2: Create Just the team_invites Table

If you only need the `team_invites` table:

1. Go to **Supabase Dashboard → SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `database/create_team_invites_table.sql`
4. Click **Run**

## Verify It Was Created

After running the SQL:

1. Go to **Supabase Dashboard → Database → Table Editor**
2. Search for `team_invites`
3. You should see the table with these columns:
   - `id` (uuid)
   - `workspace_id` (uuid)
   - `email` (text)
   - `invited_by` (uuid)
   - `role` (text: owner/admin/member/viewer)
   - `invite_token` (text)
   - `expires_at` (timestamptz)
   - `accepted_at` (timestamptz, nullable)
   - `message` (text, nullable)
   - `created_at` (timestamptz)

## After Creating the Table

1. **Refresh your app** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
2. **Try inviting a team member again**
3. The invite should now be saved to the database and email should be sent

## Important Notes

- The table uses `invite_token` (not `status`) - this is required for the email invite flow
- The table uses `role` (not `access_level`) - must be one of: 'owner', 'admin', 'member', 'viewer'
- RLS policies are created automatically - users can only see/manage invites for their workspace

## Troubleshooting

If you still get errors after creating the table:

1. **Refresh schema cache**: Go to Supabase Dashboard → Database → Tables and refresh the page
2. **Check RLS policies**: Go to Database → Tables → team_invites → Policies tab - should see 4 policies
3. **Verify indexes**: Should see 3 indexes on the table (workspace_id, email, invite_token)

