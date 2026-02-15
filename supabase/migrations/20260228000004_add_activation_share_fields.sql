-- Add share link columns to activations (view-only share, same pattern as campaigns)
-- Run this migration in Supabase SQL Editor if share features show "column not found" errors.

ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_password_hash TEXT;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_password_protected BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_activations_share_token
  ON public.activations(share_token)
  WHERE share_token IS NOT NULL;
