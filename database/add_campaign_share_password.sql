-- Add password protection fields to campaigns table for view-only sharing
-- Run this script in your Supabase SQL Editor

-- Add password-related columns to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
ADD COLUMN IF NOT EXISTS share_password_protected BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.campaigns.share_password_hash IS 'SHA-256 hash of the password for password-protected share links (NULL if not password-protected)';
COMMENT ON COLUMN public.campaigns.share_password_protected IS 'Whether this share link requires a password to access';

