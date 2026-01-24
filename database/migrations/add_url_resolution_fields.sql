-- Migration: Add URL resolution fields to posts table
-- This supports the "Resolve short TikTok links" feature

-- Add fields to store resolution details
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS input_url TEXT,
ADD COLUMN IF NOT EXISTS canonical_url TEXT,
ADD COLUMN IF NOT EXISTS creator_handle TEXT,
ADD COLUMN IF NOT EXISTS resolve_status TEXT DEFAULT 'pending', -- pending, resolved, failed
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN public.posts.input_url IS 'Original URL pasted by user (potentially shortened)';
COMMENT ON COLUMN public.posts.canonical_url IS 'Resolved final URL after following redirects';
COMMENT ON COLUMN public.posts.creator_handle IS 'Handle extracted during URL resolution or scraping';