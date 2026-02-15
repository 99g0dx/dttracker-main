-- Migration: Allow zero budget for test_mode activations (Dobbletap testing)
-- The activations_contest_min_budget constraint blocks contests with total_budget < 2000.
-- Test mode activations (total_budget = 0, test_mode = true) need to be allowed.

-- Ensure test_mode column exists (from 20260207999999)
ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

-- Drop existing contest min budget constraint
ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_contest_min_budget;

-- Add constraint: for contests, require total_budget >= 2000 unless test_mode allows 0
ALTER TABLE public.activations
  ADD CONSTRAINT activations_contest_min_budget
  CHECK (
    type != 'contest'
    OR total_budget >= 2000
    OR COALESCE(test_mode, false) = true
  );

COMMENT ON CONSTRAINT activations_contest_min_budget ON public.activations IS
  'Contests need min ₦2,000 budget, except test_mode activations which allow 0 for Dobbletap testing';
