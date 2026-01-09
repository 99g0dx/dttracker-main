-- Migration: Add last_scraped_at column to posts table if it doesn't exist
-- This is safe to run multiple times (uses IF NOT EXISTS)

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

-- Optional: Add a comment to document the column
COMMENT ON COLUMN public.posts.last_scraped_at IS 'Timestamp of when the post was last successfully scraped';

