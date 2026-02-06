-- One-step script to find workspace and reset wallet
-- Run this in Supabase Dashboard -> SQL Editor
-- Replace 'YOUR_EMAIL' with your actual email address

-- Find workspace_id and reset wallet in one go
DO $$
DECLARE
  v_workspace_id UUID;
  v_user_email TEXT := 'YOUR_EMAIL'; -- Replace with your email
BEGIN
  -- Find workspace_id from email
  SELECT COALESCE(wm.workspace_id, u.id) INTO v_workspace_id
  FROM auth.users u
  LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
  WHERE u.email = v_user_email
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', v_user_email;
  END IF;

  -- Create or reset wallet
  INSERT INTO workspace_wallets (workspace_id, balance, locked_balance, currency, updated_at)
  VALUES (v_workspace_id, 0, 0, 'NGN', NOW())
  ON CONFLICT (workspace_id) 
  DO UPDATE SET
    balance = 0,
    locked_balance = 0,
    updated_at = NOW();

  -- Return result
  RAISE NOTICE '✅ Wallet reset for workspace_id: %', v_workspace_id;
END $$;

-- Verify the result
SELECT 
  workspace_id,
  balance,
  locked_balance,
  currency,
  updated_at,
  '✅ Ready for testing' as status
FROM workspace_wallets
WHERE workspace_id IN (
  SELECT COALESCE(wm.workspace_id, u.id)
  FROM auth.users u
  LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
  WHERE u.email = 'YOUR_EMAIL' -- Replace with your email
);
