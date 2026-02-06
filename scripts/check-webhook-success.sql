-- Check if Paystack webhook successfully processed wallet funding
-- Run this in Supabase Dashboard -> SQL Editor
-- Replace 'YOUR_WORKSPACE_ID' with your actual workspace_id UUID

-- 1. Check wallet balance
SELECT 
  workspace_id,
  balance,
  locked_balance,
  currency,
  updated_at,
  CASE 
    WHEN balance > 0 THEN '✅ Wallet has balance'
    ELSE '⚠️ Wallet balance is 0'
  END as status
FROM workspace_wallets
WHERE workspace_id = 'YOUR_WORKSPACE_ID';

-- 2. Check recent fund transactions
SELECT 
  id,
  type,
  amount,
  balance_after,
  reference_type,
  status,
  description,
  metadata->>'paystack_reference' as paystack_reference,
  created_at
FROM wallet_transactions
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
  AND type = 'fund'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check billing_events (if webhook logged there)
SELECT 
  event_type,
  paystack_event_id,
  reference,
  processed_at,
  processing_error,
  created_at
FROM billing_events
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
  AND event_type = 'charge.success'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Find latest transaction with Paystack reference
SELECT 
  wt.*,
  ww.balance as current_wallet_balance
FROM wallet_transactions wt
LEFT JOIN workspace_wallets ww ON ww.workspace_id = wt.workspace_id
WHERE wt.workspace_id = 'YOUR_WORKSPACE_ID'
  AND wt.type = 'fund'
  AND wt.metadata->>'paystack_reference' IS NOT NULL
ORDER BY wt.created_at DESC
LIMIT 1;
