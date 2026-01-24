-- Migration: Update creators table schema for new architecture
-- Adds created_by_workspace_id and new fields, updates unique constraint

-- Add created_by_workspace_id to creators (global creator origin)
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS created_by_workspace_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add other fields if they don't exist
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS profile_url TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Update unique constraint to be (platform, handle) instead of (user_id, handle, platform)
-- First, drop old constraint if exists (check by name)
DO $$
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'creators_user_id_handle_platform_key'
  ) THEN
    ALTER TABLE public.creators DROP CONSTRAINT creators_user_id_handle_platform_key;
  END IF;
END $$;

-- Add new unique constraint on (platform, handle) if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS creators_platform_handle_unique 
ON public.creators(platform, handle);

-- Migrate existing data: populate workspace_creators from created_by_workspace_id
-- This will only run if workspace_creators table exists
INSERT INTO public.workspace_creators (workspace_id, creator_id, source, created_at)
SELECT 
  COALESCE(c.created_by_workspace_id, c.user_id) as workspace_id,
  c.id as creator_id,
  CASE 
    WHEN c.source_type = 'csv_import' THEN 'csv'
    WHEN c.source_type = 'scraper_extraction' THEN 'scraper'
    ELSE 'manual'
  END as source,
  c.created_at
FROM public.creators c
WHERE COALESCE(c.created_by_workspace_id, c.user_id) IS NOT NULL
  -- Ensure the referenced user/workspace actually exists to avoid FK violation
  AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = COALESCE(c.created_by_workspace_id, c.user_id)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_creators wc
    WHERE wc.creator_id = c.id
      AND wc.workspace_id = COALESCE(c.created_by_workspace_id, c.user_id)
  )
ON CONFLICT (workspace_id, creator_id) DO NOTHING;

-- Set created_by_workspace_id from user_id for existing data
UPDATE public.creators
SET created_by_workspace_id = user_id
WHERE user_id IS NOT NULL AND created_by_workspace_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_creators_created_by_workspace_id ON public.creators(created_by_workspace_id);

-- Add comments
COMMENT ON COLUMN public.creators.created_by_workspace_id IS 'Workspace that first introduced this creator into the system (for tracking/harvesting)';
COMMENT ON COLUMN public.creators.contact_email IS 'Contact email (separate from email field for clarity)';
