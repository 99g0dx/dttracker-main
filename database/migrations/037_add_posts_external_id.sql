-- Migration: Add external_id to posts table for deduplication
-- Description: Adds external_id column and unique index to prevent duplicate posts

-- Add external_id column to posts table
-- This stores platform-specific identifiers:
-- - TikTok: video ID (numeric string)
-- - Instagram: shortcode (alphanumeric)
-- - YouTube: video ID
-- - Twitter: tweet ID
-- - Facebook: post ID
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Add owner_username column to store the scraped username
-- Useful when Instagram posts are added without a handle in the URL
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS owner_username TEXT;

-- Create unique index for deduplication
-- Prevents adding the same post twice within a campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_campaign_platform_external_id
ON public.posts (campaign_id, platform, external_id)
WHERE external_id IS NOT NULL;

-- Add index for faster lookups by external_id
CREATE INDEX IF NOT EXISTS idx_posts_external_id
ON public.posts (external_id)
WHERE external_id IS NOT NULL;

-- Comment on the columns
COMMENT ON COLUMN public.posts.external_id IS 'Platform-specific identifier (TikTok video ID, Instagram shortcode, etc.)';
COMMENT ON COLUMN public.posts.owner_username IS 'Username of the post owner as returned by the scraper';
