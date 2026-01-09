# Implement Database Migrations - Quick Start

## 🚀 Fastest Way: Run Combined Migration

### Step 1: Open Supabase SQL Editor

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**

### Step 2: Run the Combined Migration

1. Open the file: `database/migrations/000_run_all_migrations.sql`
2. **Copy the entire contents** (Cmd+A, Cmd+C / Ctrl+A, Ctrl+C)
3. **Paste into Supabase SQL Editor**
4. Click **Run** (bottom right)

### Step 3: Verify Success

You should see:
- ✅ Success message at the bottom
- ✅ Verification query results showing tables and functions created
- ✅ Notice messages indicating completion

## 📋 What Gets Created

After running the migration, you'll have:

### Tables
- ✅ `workspaces` - For future multi-workspace support
- ✅ `team_members` - Updated with proper UUID function
- ✅ `team_invites` - **This fixes your current issue!**

### Features
- ✅ `pgcrypto` extension enabled (`gen_random_uuid()`)
- ✅ RLS enabled on all tables
- ✅ Security policies for authenticated users
- ✅ Helper function: `is_workspace_admin()`
- ✅ Indexes for performance

## 🔍 Verification Steps

After running the migration, verify in Supabase Dashboard:

1. **Check Tables:**
   - Go to **Database → Table Editor**
   - You should see: `workspaces`, `team_members`, `team_invites`

2. **Check RLS:**
   - Click on `team_invites` table
   - Go to **Policies** tab
   - Should see 4 policies

3. **Test Your App:**
   - Hard refresh your app (Cmd+Shift+R / Ctrl+Shift+R)
   - Go to Team page
   - Try creating an invite
   - ✅ Should work now!

## 🎯 Quick Fix (Team Invites Only)

If you only need to fix the `team_invites` table right now:

1. Go to **Supabase Dashboard → SQL Editor**
2. Open: `database/migrations/009_fix_team_invites_uuid.sql`
3. Copy and paste contents
4. Click **Run**

This will create the `team_invites` table and fix the immediate issue.

## 📝 Alternative: Run Migrations One by One

If you prefer to run migrations individually:

1. Run `001_create_extension_pgcrypto.sql`
2. Run `002_create_workspaces.sql`
3. Run `003_add_workspaces_constraints_indexes.sql`
4. Run `004_create_team_members.sql`
5. Run `005_add_audit_columns_workspaces.sql`
6. Run `006_enable_rls_and_policies_team_members.sql`
7. Run `007_enable_rls_and_policies_workspaces.sql`
8. Run `008_helper_function_is_workspace_admin.sql`
9. Run `009_fix_team_invites_uuid.sql`

Each migration is idempotent (safe to run multiple times).

## ⚠️ Important Notes

### Backward Compatibility
- ✅ Migrations won't break existing code
- ✅ Current `workspace_id = user_id` model still works
- ✅ Existing data is preserved

### UUID Function Change
- ✅ Uses `gen_random_uuid()` from `pgcrypto` (recommended)
- ✅ More reliable than `uuid-ossp` extension
- ✅ No conflicts with existing UUIDs

## 🐛 Troubleshooting

### Error: "extension already exists"
- **Safe to ignore** - extension is already installed

### Error: "table already exists"
- Migrations use `IF NOT EXISTS`, so this shouldn't happen
- If you see it, the table exists and you can continue

### Error: "policy already exists"
- Migrations check for existing policies
- If error persists, you can skip that policy creation

### Still getting "table not found" after migration
1. **Refresh Supabase Dashboard** → Database → Tables
2. **Clear browser cache** and refresh your app
3. **Verify** you're looking at the correct Supabase project

## ✅ After Migration

1. ✅ Tables created
2. ✅ RLS enabled
3. ✅ Policies active
4. ✅ Test team invite functionality
5. ✅ Deploy to Vercel (if needed)

Your team invite feature should now work end-to-end! 🎉

## 📚 Migration Files Location

All migration files are in: `database/migrations/`

- `000_run_all_migrations.sql` - Combined file (easiest)
- `001-009_*.sql` - Individual migrations
- `README.md` - Detailed documentation

