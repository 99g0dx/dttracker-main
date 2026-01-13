-- Migration: Migrate existing data to workspace_creators structure
-- This ensures all existing creators with created_by_workspace_id are in workspace_creators
-- Run this after creating the workspace_creators table

-- Insert into workspace_creators for all creators that have a workspace owner
INSERT INTO public.workspace_creators (workspace_id, creator_id, source, created_at)
SELECT 
  COALESCE(created_by_workspace_id, user_id) as workspace_id,
  c.id as creator_id,
  CASE 
    WHEN c.source_type = 'csv_import' THEN 'csv'
    WHEN c.source_type = 'scraper_extraction' THEN 'scraper'
    ELSE 'manual'
  END as source,
  c.created_at
FROM public.creators c
WHERE COALESCE(c.created_by_workspace_id, c.user_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_creators wc
    WHERE wc.workspace_id = COALESCE(c.created_by_workspace_id, c.user_id)
      AND wc.creator_id = c.id
  )
ON CONFLICT (workspace_id, creator_id) DO NOTHING;
