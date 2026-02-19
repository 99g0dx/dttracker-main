-- Add profile_status column to creators table.
-- Tracks whether a creator has published their profile on Dobble Tap.
-- 'draft' = not visible on discover, 'live' = visible on discover.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'creators' AND column_name = 'profile_status'
  ) THEN
    ALTER TABLE public.creators
      ADD COLUMN profile_status TEXT NOT NULL DEFAULT 'draft'
      CHECK (profile_status IN ('draft', 'live'));
  END IF;
END $$;

-- Index for discover page filtering
CREATE INDEX IF NOT EXISTS idx_creators_profile_status
  ON public.creators(profile_status) WHERE profile_status = 'live';
