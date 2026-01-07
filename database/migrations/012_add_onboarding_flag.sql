-- ============================================================
-- Migration 012: Add onboarding_completed flag to profiles
-- ============================================================

-- Add onboarding_completed column to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to mark onboarding as completed
-- This ensures existing users are not prompted for onboarding
UPDATE public.profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
ON public.profiles(onboarding_completed)
WHERE onboarding_completed = FALSE;

-- Verification query (comment out in production)
-- SELECT COUNT(*) as users_needing_onboarding 
-- FROM public.profiles 
-- WHERE onboarding_completed = FALSE;

