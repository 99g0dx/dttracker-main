-- Fix: Add activation share columns if you see "Could not find share_created_at column" or
-- "Activation not found or access denied" when using Share activation.
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run.

ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_password_hash TEXT;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS share_password_protected BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_activations_share_token
  ON public.activations(share_token)
  WHERE share_token IS NOT NULL;
