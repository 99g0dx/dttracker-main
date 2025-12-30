-- Add share fields to campaigns table for view-only sharing
-- Run this script in your Supabase SQL Editor

-- Add share-related columns to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_allow_export BOOLEAN NOT NULL DEFAULT false;

-- Create index on share_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_share_token ON public.campaigns(share_token)
WHERE share_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.campaigns.share_enabled IS 'Whether view-only sharing is enabled for this campaign';
COMMENT ON COLUMN public.campaigns.share_token IS 'Unique token for public share link (generated when sharing is enabled)';
COMMENT ON COLUMN public.campaigns.share_created_at IS 'Timestamp when sharing was enabled';
COMMENT ON COLUMN public.campaigns.share_expires_at IS 'Optional expiration timestamp for share link (NULL = never expires)';
COMMENT ON COLUMN public.campaigns.share_allow_export IS 'Whether shared view allows CSV export';

