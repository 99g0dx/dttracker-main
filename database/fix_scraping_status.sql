-- migrations/2025xxxx_add_posts_status_check.sql
-- Idempotent migration to ensure posts_status_check includes 'scraping'

DO $$
DECLARE
  def TEXT;
BEGIN
  -- Get existing CHECK constraint definition (if present)
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conrelid = 'public.posts'::regclass
    AND contype = 'c'
    AND conname = 'posts_status_check';

  IF def IS NULL THEN
    -- No existing constraint with that name: create it
    EXECUTE
      'ALTER TABLE public.posts
       ADD CONSTRAINT posts_status_check
       CHECK (status IN (''pending'',''scraped'',''failed'',''manual'',''scraping''))';
  ELSIF def NOT ILIKE '%scraping%' THEN
    -- Constraint exists but doesn't include ''scraping'': replace it
    EXECUTE 'ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check';
    EXECUTE
      'ALTER TABLE public.posts
       ADD CONSTRAINT posts_status_check
       CHECK (status IN (''pending'',''scraped'',''failed'',''manual'',''scraping''))';
  END IF;
END$$;