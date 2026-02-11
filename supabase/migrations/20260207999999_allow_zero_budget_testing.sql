-- Migration: Allow zero/minimal budget for testing activations
-- This allows creating test activations without funds for Dobbletap integration testing

-- Remove minimum budget constraint for contests (was 2000 NGN)
ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_contest_min_budget;

-- Add new constraint allowing zero budget (for testing)
-- In production, you may want to re-enable minimum budgets
-- Idempotent: drop if exists so migration works when constraint already exists
ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_budget_non_negative;
ALTER TABLE public.activations
  ADD CONSTRAINT activations_budget_non_negative
  CHECK (total_budget >= 0);

-- Add a test_mode flag to identify test activations (optional but recommended)
ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.activations.test_mode IS
  'Set to true for test activations that bypass wallet/budget requirements';
