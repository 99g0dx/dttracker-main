-- Migration: Lower contest min budget (temporary testing)
-- Allows contest total_budget >= 2000

ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_contest_min_budget;

ALTER TABLE public.activations
  ADD CONSTRAINT activations_contest_min_budget
  CHECK (type != 'contest' OR total_budget >= 2000);
