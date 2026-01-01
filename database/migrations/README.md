# Database Migrations

This directory contains sequential SQL migration files that should be run in order to set up and maintain the database schema.

## Migration Order

Run these migrations in sequence (001 → 009):

1. **001_create_extension_pgcrypto.sql** - Enable pgcrypto extension for `gen_random_uuid()`
2. **002_create_workspaces.sql** - Create workspaces table (for future multi-workspace support)
3. **003_add_workspaces_constraints_indexes.sql** - Add constraints and indexes to workspaces
4. **004_create_team_members.sql** - Create/update team_members table with proper UUID function
5. **005_add_audit_columns_workspaces.sql** - Add audit columns to workspaces
6. **006_enable_rls_and_policies_team_members.sql** - Enable RLS and add policies for team_members
7. **007_enable_rls_and_policies_workspaces.sql** - Enable RLS and add policies for workspaces
8. **008_helper_function_is_workspace_admin.sql** - Create helper function for permission checks
9. **009_fix_team_invites_uuid.sql** - Create team_invites table with proper UUID function and RLS

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard → SQL Editor**
2. For each migration file (in order):
   - Click **New Query**
   - Copy and paste the contents of the migration file
   - Click **Run**
   - Verify success message

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI set up locally
supabase db push
```

Or manually:
```bash
# Connect to your database and run each file
psql $DATABASE_URL -f 001_create_extension_pgcrypto.sql
psql $DATABASE_URL -f 002_create_workspaces.sql
# ... etc
```

### Option 3: Run All at Once

You can combine all migrations into a single file and run it:

```bash
cat *.sql > all_migrations.sql
# Then run all_migrations.sql in Supabase SQL Editor
```

## Important Notes

### Current Architecture

- The current codebase uses `workspace_id = user_id` (single workspace per user)
- These migrations create a proper `workspaces` table for future multi-workspace support
- The migrations are backward-compatible and won't break existing functionality
- The `team_invites` table is created with the correct schema matching your TypeScript types

### UUID Functions

- Migrations use `gen_random_uuid()` from `pgcrypto` extension (recommended)
- Previous schema used `uuid_generate_v4()` from `uuid-ossp`
- New tables and default values use `gen_random_uuid()`
- Existing data remains unchanged

### Idempotency

All migrations use `IF NOT EXISTS` checks, so they can be safely run multiple times without errors.

### RLS Policies

- Policies are created only if they don't already exist
- Existing policies are preserved
- New policies complement existing ones

## Verification

After running all migrations, verify:

1. **Tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('workspaces', 'team_members', 'team_invites')
   ORDER BY table_name;
   ```

2. **RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename IN ('workspaces', 'team_members', 'team_invites');
   ```

3. **Policies exist:**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename IN ('workspaces', 'team_members', 'team_invites')
   ORDER BY tablename, policyname;
   ```

4. **Helper function exists:**
   ```sql
   SELECT proname FROM pg_proc 
   WHERE proname = 'is_workspace_admin';
   ```

## Troubleshooting

### Error: "extension already exists"
- Safe to ignore - extension is already installed

### Error: "table already exists"
- Migrations use `IF NOT EXISTS`, so this shouldn't happen
- If it does, the table exists and you can skip that migration

### Error: "policy already exists"
- Migrations check for existing policies before creating
- If you see this, the policy exists and migration can continue

### RLS blocking queries
- Check that you're authenticated
- Verify policies match your use case
- Test with `auth.uid()` to see current user ID

## Next Steps

After running migrations:

1. ✅ Tables created
2. ✅ RLS enabled
3. ✅ Policies active
4. ✅ Helper functions available
5. Test team invite functionality
6. Deploy to production

