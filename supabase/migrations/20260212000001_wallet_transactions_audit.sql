-- Migration: Wallet transactions audit - locked_balance_after, processed_at, status enum
-- Phase 1 of wallet improvements plan.

-- Add locked_balance_after (snapshot of locked balance after transaction)
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS locked_balance_after NUMERIC;

-- Add processed_at (when transaction was completed/failed)
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Update status CHECK to include pending, failed, reversed
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_status_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_status_check
  CHECK (status IS NULL OR status IN ('pending', 'completed', 'failed', 'reversed'));

-- Backfill: set balance_after and locked_balance_after from current workspace_wallets where NULL
UPDATE public.wallet_transactions wt
SET
  balance_after = COALESCE(wt.balance_after, ww.balance),
  locked_balance_after = COALESCE(wt.locked_balance_after, ww.locked_balance)
FROM public.workspace_wallets ww
WHERE wt.workspace_id = ww.workspace_id
  AND (wt.balance_after IS NULL OR wt.locked_balance_after IS NULL);

-- Set processed_at for existing completed rows
UPDATE public.wallet_transactions
SET processed_at = created_at
WHERE status = 'completed' AND processed_at IS NULL;
