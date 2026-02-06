-- Clear wallet completely: balance to 0 AND delete all transaction history
-- Run this in Supabase Dashboard -> SQL Editor
-- Replace 'YOUR_WORKSPACE_ID' with your actual workspace_id UUID

-- 1. Delete all transactions for this workspace
DELETE FROM wallet_transactions
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- 2. Reset balance to 0
UPDATE workspace_wallets
SET 
  balance = 0,
  locked_balance = 0,
  updated_at = NOW()
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- 3. Verify: balance is 0 and no transactions
SELECT workspace_id, balance, locked_balance, updated_at
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

SELECT count(*) AS transaction_count
FROM wallet_transactions
WHERE workspace_id = 'YOUR_WORKSPACE_ID';
