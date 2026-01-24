-- Migration: Backfill missing workspaces for all existing users.
-- This script finds all users in auth.users who do not have a corresponding
-- record in the public.workspaces table and creates one for them.
-- This is necessary to prevent foreign key violations when creating
-- resources like 'workspace_creators' for older user accounts.

INSERT INTO public.workspaces (id, user_id, owner_user_id, name, created_at, updated_at)
SELECT 
    u.id,           -- id
    u.id,           -- user_id
    u.id,           -- owner_user_id
    'My Workspace', -- default name
    NOW(),          -- created_at
    NOW()           -- updated_at
FROM auth.users u
LEFT JOIN public.workspaces w ON u.id = w.id
WHERE w.id IS NULL;