# Quick Fix: RLS Infinite Recursion Error

## 🚨 The Problem

Error: `"infinite recursion detected in policy for relation team_members"`

**Cause:** RLS policies were querying the `team_members` table within policies for `team_members`, creating an infinite loop.

## ✅ The Solution

**Answer: NO** - There is no separate `workspace_members` table.

Your database uses: `workspace_id = user_id` (workspace owner = user ID).

The fix uses simple, non-recursive policies that check `workspace_id = auth.uid()` directly.

## 🚀 Quick Fix (Run This Now)

### Step 1: Fix team_members Policies

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Drop recursive policies
DROP POLICY IF EXISTS "team_members_workspace_insert" ON public.team_members;
DROP POLICY IF EXISTS "team_members_workspace_read" ON public.team_members;

-- Create non-recursive policies
CREATE POLICY "Workspace owner can add team members"
ON public.team_members FOR INSERT
TO authenticated
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Users can view team members in their workspace"
ON public.team_members FOR SELECT
TO authenticated
USING (workspace_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Workspace owner can update team members"
ON public.team_members FOR UPDATE
TO authenticated
USING (workspace_id = auth.uid())
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can remove team members"
ON public.team_members FOR DELETE
TO authenticated
USING (workspace_id = auth.uid());
```

### Step 2: Fix team_invites Policies

Run this SQL:

```sql
-- Drop recursive policies
DROP POLICY IF EXISTS "Users can create invites in their workspace" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owners can update invites" ON public.team_invites;
DROP POLICY IF EXISTS "Workspace owners can delete invites" ON public.team_invites;

-- Create non-recursive policies
CREATE POLICY "Workspace owner can create invites"
ON public.team_invites FOR INSERT
TO authenticated
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can update invites"
ON public.team_invites FOR UPDATE
TO authenticated
USING (workspace_id = auth.uid())
WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Workspace owner can delete invites"
ON public.team_invites FOR DELETE
TO authenticated
USING (workspace_id = auth.uid());
```

## 📁 Or Use Migration Files

Run these migration files in order:
1. `database/migrations/010_fix_team_members_rls_recursion.sql`
2. `database/migrations/011_fix_team_invites_rls_recursion.sql`

## ✅ After Fix

1. Refresh your app
2. Try creating a team invite
3. ✅ Should work now!

## Why This Works

**Before (BAD - Recursive):**
```sql
EXISTS (SELECT 1 FROM team_members WHERE ...)  -- Queries itself!
```

**After (GOOD - Non-recursive):**
```sql
workspace_id = auth.uid()  -- Direct check, no query needed
```

This checks if the current user owns the workspace directly, without querying any tables.

