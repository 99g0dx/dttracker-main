-- Migration: Add created_by_workspace_id to creators table
-- Deprecated file name retained for backward compatibility
-- My Network creators: created_by_workspace_id = user_id (workspace owner)
-- All Creators (agency inventory): created_by_workspace_id IS NULL

-- Add created_by_workspace_id column
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS created_by_workspace_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Migrate existing data: set created_by_workspace_id = user_id for existing creators
-- This makes all existing creators part of "My Network" for their respective users
UPDATE public.creators 
SET created_by_workspace_id = user_id 
WHERE created_by_workspace_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_creators_created_by_workspace_id ON public.creators(created_by_workspace_id);

-- Add comment for documentation
COMMENT ON COLUMN public.creators.created_by_workspace_id IS 'Workspace that first introduced this creator into the system (for tracking/harvesting)';
