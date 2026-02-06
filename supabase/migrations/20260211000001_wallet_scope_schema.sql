-- Migration: Wallet scope schema - pending_balance, lifetime_spent, transaction types, description, status
-- Part of DTTracker wallet scope implementation (workspace-side only)

-- workspace_wallets: add pending_balance and lifetime_spent
ALTER TABLE public.workspace_wallets
  ADD COLUMN IF NOT EXISTS pending_balance NUMERIC NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  ADD COLUMN IF NOT EXISTS lifetime_spent NUMERIC NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0);

-- wallet_transactions: add description and status
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Extend type CHECK to include 'fee' and 'withdrawal'
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wallet_transactions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.wallet_transactions DROP CONSTRAINT %I', r.conname);
    EXIT;
  END LOOP;
END $$;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('fund', 'lock', 'unlock', 'payout', 'refund', 'fee', 'withdrawal'));

-- Backfill: ensure existing workspace_wallets have pending_balance and lifetime_spent set
UPDATE public.workspace_wallets
SET pending_balance = COALESCE(pending_balance, 0),
    lifetime_spent = COALESCE(lifetime_spent, 0)
WHERE pending_balance IS NULL OR lifetime_spent IS NULL;
