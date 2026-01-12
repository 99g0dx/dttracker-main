-- Migration: Add owner_workspace_id to creators table
-- This migration adds the owner_workspace_id field to properly classify creator ownership
-- My Network creators: owner_workspace_id = user_id (workspace owner)
-- All Creators (agency inventory): owner_workspace_id IS NULL

-- Add owner_workspace_id column
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS owner_workspace_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Migrate existing data: set owner_workspace_id = user_id for existing creators
-- This makes all existing creators part of "My Network" for their respective users
UPDATE public.creators 
SET owner_workspace_id = user_id 
WHERE owner_workspace_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_creators_owner_workspace_id ON public.creators(owner_workspace_id);

-- Add comment for documentation
COMMENT ON COLUMN public.creators.owner_workspace_id IS 'Workspace that owns this creator. NULL for agency inventory (All Creators), user_id for workspace-owned creators (My Network)';
