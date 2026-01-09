-- Add last_scraped_at column to posts table
-- This column tracks when a post was last scraped for metrics

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'posts'
    AND column_name = 'last_scraped_at'
  ) THEN
    ALTER TABLE public.posts
    ADD COLUMN last_scraped_at TIMESTAMPTZ;
    
    RAISE NOTICE 'Column last_scraped_at added to posts table';
  ELSE
    RAISE NOTICE 'Column last_scraped_at already exists in posts table';
  END IF;
END
$$;

