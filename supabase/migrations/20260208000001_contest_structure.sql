-- Migration: Contest structure - 20 winners, min 300k, max 5 posts per creator
-- Adds max_posts_per_creator, enforces minimum prize pool for contests, backfills prize structure

-- Add max_posts_per_creator (contest-only, default 5)
ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS max_posts_per_creator INTEGER DEFAULT 5;

-- Backfill winner_count = 20 and prize_structure for existing contests
DO $$
DECLARE
  r RECORD;
  first_prize NUMERIC;
  second_prize NUMERIC;
  third_prize NUMERIC;
  remaining_pool NUMERIC;
  remaining_per_winner NUMERIC;
  ps JSONB;
BEGIN
  FOR r IN
    SELECT id, total_budget
    FROM public.activations
    WHERE type = 'contest'
  LOOP
    first_prize := r.total_budget * 0.25;
    second_prize := r.total_budget * 0.15;
    third_prize := r.total_budget * 0.10;
    remaining_pool := r.total_budget * 0.50;
    remaining_per_winner := remaining_pool / 17;

    ps := jsonb_build_object(
      '1', first_prize,
      '2', second_prize,
      '3', third_prize
    );
    FOR i IN 4..20 LOOP
      ps := ps || jsonb_build_object(i::text, remaining_per_winner);
    END LOOP;

    UPDATE public.activations
    SET winner_count = 20,
        prize_structure = ps,
        max_posts_per_creator = COALESCE(max_posts_per_creator, 5)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Ensure no contests have budget < 300k before adding constraint
UPDATE public.activations
SET total_budget = 300000
WHERE type = 'contest' AND total_budget < 300000;

-- Add CHECK for minimum contest prize pool
ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_contest_min_budget;

ALTER TABLE public.activations
  ADD CONSTRAINT activations_contest_min_budget
  CHECK (type != 'contest' OR total_budget >= 300000);
