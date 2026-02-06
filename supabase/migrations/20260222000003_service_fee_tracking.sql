-- Migration: Add service fee tracking to wallet transactions
-- Tracks 10% service fee on all activations and creator requests

-- Add service_fee_amount column to wallet_transactions
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC DEFAULT 0 CHECK (service_fee_amount >= 0);

-- Update type constraint to include 'service_fee'
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('fund', 'lock', 'unlock', 'payout', 'refund', 'service_fee'));

-- Create index for service fee transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_service_fee ON public.wallet_transactions(type, service_fee_amount) 
  WHERE type = 'service_fee' AND service_fee_amount > 0;

COMMENT ON COLUMN public.wallet_transactions.service_fee_amount IS 'Service fee amount (10% of activation/request cost)';
COMMENT ON COLUMN public.wallet_transactions.type IS 'Transaction type: fund, lock, unlock, payout, refund, or service_fee';
