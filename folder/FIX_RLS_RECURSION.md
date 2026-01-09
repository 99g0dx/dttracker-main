# Fix RLS Infinite Recursion Error

## Problem

The error `"infinite recursion detected in policy for relation team_members"` occurs because RLS policies are querying the `team_members` table within policies for the `team_members` table itself.

## Root Cause

The migration files `006_enable_rls_and_policies_team_members.sql` and `009_fix_team_invites_uuid.sql` contain policies like:

```sql
EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.workspace_id = team_members.workspace_id
  ...
)
```

This creates an infinite loop:
- To INSERT into `team_members`, check the policy
- Policy queries `team_members` table
- Querying `team_members` triggers the policy check
- Policy queries `team_members` again → infinite recursion

## Solution

**Answer: NO**, there is no separate `workspace_members` table.

Your database uses the pattern: `workspace_id = user_id` (workspace owner's user ID).

The fix uses non-recursive policies that check `workspace_id = auth.uid()` directly, without querying the `team_members` table.

## Quick Fix

Run these two migration files in Supabase SQL Editor:

1. **`010_fix_team_members_rls_recursion.sql`** - Fixes team_members policies
2. **`011_fix_team_invites_rls_recursion.sql`** - Fixes team_invites policies

## What Gets Fixed

### team_members Policies
- ❌ Removed: Recursive INSERT policy that queried `team_members`
- ❌ Removed: Recursive SELECT policy that queried `team_members`
- ✅ Added: Simple INSERT policy: `workspace_id = auth.uid()`
- ✅ Added: Simple SELECT policy: `workspace_id = auth.uid() OR user_id = auth.uid()`
- ✅ Added: Simple UPDATE/DELETE policies: `workspace_id = auth.uid()`

### team_invites Policies
- ❌ Removed: Recursive INSERT/UPDATE/DELETE policies
- ✅ Added: Simple policies using `workspace_id = auth.uid()`

## How to Apply

1. Go to **Supabase Dashboard → SQL Editor**
2. Open `database/migrations/010_fix_team_members_rls_recursion.sql`
3. Copy and paste, click **Run**
4. Open `database/migrations/011_fix_team_invites_rls_recursion.sql`
5. Copy and paste, click **Run**

## After Fix

✅ Team invites will work
✅ No more recursion errors
✅ Policies are simple and efficient
✅ Works with your current `workspace_id = user_id` model

## Why This Works

Instead of:
```sql
-- BAD: Queries team_members (recursion)
EXISTS (SELECT 1 FROM team_members WHERE ...)
```

We use:
```sql
-- GOOD: Direct check (no recursion)
workspace_id = auth.uid()
```

This checks if the current user's ID matches the workspace_id (workspace owner), without querying any tables.

## Verification

After running the fixes:
1. Refresh your app
2. Try creating a team invite
3. Should work without recursion errors!

