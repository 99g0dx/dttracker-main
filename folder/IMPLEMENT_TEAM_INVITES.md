# Implement team_invites Table - Quick Start

## ✅ What's Ready

- ✅ SQL script created: `database/create_team_invites_table.sql`
- ✅ TypeScript code matches the schema
- ✅ RLS policies included for security
- ✅ Indexes for performance

## 🚀 Implementation Steps

### Step 1: Run SQL in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `database/create_team_invites_table.sql`
4. Paste into the SQL Editor
5. Click **Run** (bottom right)

**Expected Result:** You should see "Success. No rows returned" or a success message.

### Step 2: Verify Table Creation

1. Go to **Database** → **Table Editor**
2. Search for `team_invites`
3. Verify you see these columns:
   - `id` (uuid, primary key)
   - `workspace_id` (uuid)
   - `email` (text)
   - `invited_by` (uuid)
   - `role` (text)
   - `invite_token` (text, unique)
   - `expires_at` (timestamptz)
   - `accepted_at` (timestamptz, nullable)
   - `message` (text, nullable)
   - `created_at` (timestamptz)

### Step 3: Verify RLS Policies

1. Click on the `team_invites` table
2. Go to **Policies** tab
3. You should see 4 policies:
   - ✅ "Users can view invites in their workspace"
   - ✅ "Users can create invites in their workspace"
   - ✅ "Workspace owners can update invites"
   - ✅ "Workspace owners can delete invites"

### Step 4: Test the Implementation

1. **Refresh your app** (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
2. Navigate to **Team** page
3. Click **Invite Member**
4. Fill in email and details
5. Click **Send Invitation**
6. ✅ Should create invite in database
7. ✅ Should send email (if RESEND_API_KEY is configured)

## 🔍 Troubleshooting

### Error: "relation already exists"
- The table already exists - you can skip table creation
- You can still run the RLS policies if they're missing

### Error: "policy already exists"
- The SQL uses `IF NOT EXISTS` checks, so this shouldn't happen
- If it does, it's safe to ignore - the policies are already there

### Still getting "table not found" after creating
1. **Refresh Supabase Dashboard** → Database → Tables
2. **Clear browser cache** and refresh your app
3. Check you're looking at the correct Supabase project

### Invites created but emails not sending
1. Check **RESEND_API_KEY** is set in Supabase → Edge Functions → Secrets
2. Check browser console (F12) for error messages
3. Check Supabase → Edge Functions → send-team-invite → Logs

## 📋 Schema Summary

The table structure matches your TypeScript code:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | uuid | ✅ | Primary key, auto-generated |
| `workspace_id` | uuid | ✅ | Workspace/owner ID |
| `email` | text | ✅ | Invitee email |
| `invited_by` | uuid | ✅ | User who sent invite |
| `role` | text | ✅ | owner/admin/member/viewer |
| `invite_token` | text | ✅ | Unique token for email link |
| `expires_at` | timestamptz | ✅ | When invite expires |
| `accepted_at` | timestamptz | ❌ | When invite was accepted |
| `message` | text | ❌ | Optional message |
| `created_at` | timestamptz | ✅ | Auto-generated timestamp |

## ✅ Next Steps After Implementation

1. ✅ Table created
2. ✅ RLS policies active
3. ✅ Test invite creation
4. ✅ Verify email sending
5. ✅ Deploy to Vercel (if needed)

Your team invite functionality should now work end-to-end! 🎉

