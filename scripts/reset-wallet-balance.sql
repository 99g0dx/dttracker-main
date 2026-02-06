-- Reset wallet balance to 0 for testing real Paystack funding
-- Run this in Supabase Dashboard -> SQL Editor
-- 
-- This resets the workspace_wallets table (used by frontend).
-- To also clear transaction history (no "Funding" entries), use scripts/clear-wallet-all.sql
-- Replace 'YOUR_WORKSPACE_ID' with your actual workspace_id UUID

-- Reset balance to 0
UPDATE workspace_wallets
SET 
  balance = 0,
  locked_balance = 0,
  updated_at = NOW()
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- Verify the reset
SELECT 
  id,
  workspace_id,
  balance,
  locked_balance,
  currency,
  updated_at
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- ============================================
-- OPTIONAL: Reset ALL wallets (use with caution!)
-- ============================================
-- Uncomment the lines below if you want to reset all wallets:
-- UPDATE workspace_wallets
-- SET 
--   balance = 0,
--   locked_balance = 0,
--   updated_at = NOW();

-- Verify all wallets
-- SELECT id, workspace_id, balance, locked_balance, updated_at FROM workspace_wallets;
