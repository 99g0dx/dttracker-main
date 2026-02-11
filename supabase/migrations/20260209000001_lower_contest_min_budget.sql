-- Migration: Lower contest min budget (temporary testing)
-- Allows contest total_budget >= 2000

ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_contest_min_budget;

-- Fix existing rows that would violate the new constraint
UPDATE public.activations
SET total_budget = 2000
WHERE type = 'contest' AND (total_budget IS NULL OR total_budget < 2000);

ALTER TABLE public.activations
  ADD CONSTRAINT activations_contest_min_budget
  CHECK (type != 'contest' OR total_budget >= 2000);
