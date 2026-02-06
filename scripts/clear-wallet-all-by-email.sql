-- Clear wallet completely by email: delete all transactions + reset balance to 0
-- Run this in Supabase Dashboard -> SQL Editor
-- Replace 'YOUR_EMAIL' with your actual email address

DO $$
DECLARE
  v_workspace_id UUID;
  v_user_email TEXT := 'YOUR_EMAIL'; -- Replace with your email
  v_deleted INTEGER;
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

  -- Delete all transactions for this workspace
  DELETE FROM wallet_transactions WHERE workspace_id = v_workspace_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Create or reset wallet (balance 0)
  INSERT INTO workspace_wallets (workspace_id, balance, locked_balance, currency, updated_at)
  VALUES (v_workspace_id, 0, 0, 'NGN', NOW())
  ON CONFLICT (workspace_id) 
  DO UPDATE SET
    balance = 0,
    locked_balance = 0,
    updated_at = NOW();

  RAISE NOTICE '✅ Cleared % transaction(s), wallet reset for workspace_id: %', v_deleted, v_workspace_id;
END $$;

-- Verify: balance 0 and no transactions
SELECT workspace_id, balance, locked_balance, updated_at
FROM workspace_wallets
WHERE workspace_id IN (
  SELECT COALESCE(wm.workspace_id, u.id)
  FROM auth.users u
  LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
  WHERE u.email = 'YOUR_EMAIL'
);

SELECT count(*) AS transaction_count
FROM wallet_transactions
WHERE workspace_id IN (
  SELECT COALESCE(wm.workspace_id, u.id)
  FROM auth.users u
  LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
  WHERE u.email = 'YOUR_EMAIL'
);
