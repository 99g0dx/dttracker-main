-- Migration: Add dobble_tap_user_id to community_fans
-- Stores the DT user ID directly on the fan record so activation targeting
-- doesn't depend on the creator being synced through the creators table.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_fans'
      AND column_name = 'dobble_tap_user_id'
  ) THEN
    ALTER TABLE public.community_fans ADD COLUMN dobble_tap_user_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_fans_dt_user_id
  ON public.community_fans(dobble_tap_user_id) WHERE dobble_tap_user_id IS NOT NULL;

-- Backfill from creators for fans that already have creator_id
UPDATE public.community_fans cf
SET dobble_tap_user_id = c.dobble_tap_user_id
FROM public.creators c
WHERE cf.creator_id = c.id
  AND c.dobble_tap_user_id IS NOT NULL
  AND cf.dobble_tap_user_id IS NULL;
