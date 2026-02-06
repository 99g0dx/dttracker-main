-- Migration: Add 'creator_request' type to activations
-- Creator requests allow brands to request specific creators at their quoted rates
-- Funds lock when creator accepts (not when activation is published)

-- Update the type constraint to include 'creator_request'
ALTER TABLE public.activations
  DROP CONSTRAINT IF EXISTS activations_type_check;

ALTER TABLE public.activations
  ADD CONSTRAINT activations_type_check
  CHECK (type IN ('contest', 'sm_panel', 'creator_request'));

-- Update task_type constraint to include 'content' for creator request deliverables
ALTER TABLE public.activations
  DROP CONSTRAINT IF EXISTS activations_task_type_check;

ALTER TABLE public.activations
  ADD CONSTRAINT activations_task_type_check
  CHECK (task_type IS NULL OR task_type IN ('like', 'share', 'comment', 'story', 'repost', 'content'));

COMMENT ON COLUMN public.activations.type IS 'Activation type: contest (prize-based), sm_panel (pay-per-action), or creator_request (request specific creators at their rates)';
