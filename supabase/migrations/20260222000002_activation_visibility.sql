-- Migration: Add visibility controls to activations
-- Allows activations to be public (all creators) or community-only (imported fans)

-- Add visibility column (default to 'public' for existing activations)
ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'community'));

-- Add community_fan_ids JSONB array for targeting specific fans
ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS community_fan_ids JSONB DEFAULT '[]'::jsonb;

-- Create index for filtering by visibility
CREATE INDEX IF NOT EXISTS idx_activations_visibility ON public.activations(visibility);

-- Update existing activations to be public
UPDATE public.activations SET visibility = 'public' WHERE visibility IS NULL;

COMMENT ON COLUMN public.activations.visibility IS 'Activation visibility: public (all creators) or community (imported fans only)';
COMMENT ON COLUMN public.activations.community_fan_ids IS 'Array of community_fans.id for targeting specific fans (empty array means all imported fans)';
