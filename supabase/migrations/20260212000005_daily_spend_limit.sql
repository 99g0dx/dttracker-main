-- Migration: daily_spend_limit on workspace_wallets
-- Phase 2 of wallet improvements plan.

ALTER TABLE public.workspace_wallets
  ADD COLUMN IF NOT EXISTS daily_spend_limit NUMERIC,
  ADD COLUMN IF NOT EXISTS daily_spent_today NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_spend_reset_date DATE DEFAULT CURRENT_DATE;

UPDATE public.workspace_wallets
SET daily_spent_today = COALESCE(daily_spent_today, 0),
    last_spend_reset_date = COALESCE(last_spend_reset_date, CURRENT_DATE)
WHERE daily_spent_today IS NULL OR last_spend_reset_date IS NULL;
