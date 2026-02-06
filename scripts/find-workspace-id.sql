-- Find your workspace_id for resetting wallet balance
-- Run this in Supabase Dashboard -> SQL Editor
-- Replace 'YOUR_EMAIL' with your actual email address

-- Option 1: Find workspace_id by email
SELECT 
  u.id as user_id,
  u.email,
  wm.workspace_id,
  ww.balance,
  ww.locked_balance
FROM auth.users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
LEFT JOIN workspace_wallets ww ON ww.workspace_id = wm.workspace_id
WHERE u.email = 'YOUR_EMAIL';

-- Option 2: List all workspaces with wallets
SELECT 
  ww.workspace_id,
  ww.balance,
  ww.locked_balance,
  ww.currency,
  ww.updated_at,
  u.email as owner_email
FROM workspace_wallets ww
LEFT JOIN workspaces w ON w.id = ww.workspace_id
LEFT JOIN auth.users u ON u.id = w.owner_user_id
ORDER BY ww.updated_at DESC;

-- Option 3: Find workspace_id by user_id (if you know your user ID)
-- Replace 'YOUR_USER_ID' with your UUID from auth.users
SELECT 
  workspace_id,
  balance,
  locked_balance
FROM workspace_wallets
WHERE workspace_id = 'YOUR_USER_ID';
