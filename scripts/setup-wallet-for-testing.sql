-- Setup wallet for testing real Paystack funding
-- Run this in Supabase Dashboard -> SQL Editor
-- This script will find your workspace and create/reset the wallet

-- ============================================
-- STEP 1: Find your workspace_id by email
-- ============================================
-- Replace 'YOUR_EMAIL' with your actual email address
WITH user_info AS (
  SELECT 
    u.id as user_id,
    u.email,
    COALESCE(wm.workspace_id, u.id) as workspace_id
  FROM auth.users u
  LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
  WHERE u.email = 'YOUR_EMAIL'
  LIMIT 1
)
SELECT 
  user_id,
  email,
  workspace_id,
  'Use this workspace_id below' as instruction
FROM user_info;

-- ============================================
-- STEP 2: Create or reset wallet
-- ============================================
-- After running STEP 1, copy the workspace_id and use it here
-- Replace 'YOUR_WORKSPACE_ID' with the UUID from STEP 1

-- Insert or update wallet (UPSERT)
INSERT INTO workspace_wallets (workspace_id, balance, locked_balance, currency, updated_at)
VALUES ('YOUR_WORKSPACE_ID', 0, 0, 'NGN', NOW())
ON CONFLICT (workspace_id) 
DO UPDATE SET
  balance = 0,
  locked_balance = 0,
  updated_at = NOW();

-- Verify wallet was created/reset
SELECT 
  workspace_id,
  balance,
  locked_balance,
  currency,
  updated_at,
  CASE 
    WHEN balance = 0 AND locked_balance = 0 THEN '✅ Ready for testing'
    ELSE '⚠️ Balance not zero'
  END as status
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- ============================================
-- ALTERNATIVE: List all users and their workspaces
-- ============================================
-- If you're not sure which email to use, run this first:

-- SELECT 
--   u.id as user_id,
--   u.email,
--   COALESCE(wm.workspace_id, u.id) as workspace_id,
--   ww.balance,
--   ww.locked_balance
-- FROM auth.users u
-- LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status = 'active'
-- LEFT JOIN workspace_wallets ww ON ww.workspace_id = COALESCE(wm.workspace_id, u.id)
-- ORDER BY u.created_at DESC;
