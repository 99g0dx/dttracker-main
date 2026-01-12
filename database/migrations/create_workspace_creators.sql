-- Migration: Create workspace_creators junction table
-- This table controls which creators belong to which workspace (My Network ownership)

-- Create workspace_creators junction table
CREATE TABLE IF NOT EXISTS public.workspace_creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  source TEXT CHECK (source IN ('scraper', 'csv', 'manual')) DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, creator_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_creators_workspace_id ON public.workspace_creators(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_creators_creator_id ON public.workspace_creators(creator_id);

-- Enable RLS
ALTER TABLE public.workspace_creators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_creators'
    AND policyname = 'Users can view their workspace creators'
  ) THEN
    CREATE POLICY "Users can view their workspace creators"
      ON public.workspace_creators FOR SELECT
      USING (workspace_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_creators'
    AND policyname = 'Users can insert their workspace creators'
  ) THEN
    CREATE POLICY "Users can insert their workspace creators"
      ON public.workspace_creators FOR INSERT
      WITH CHECK (workspace_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_creators'
    AND policyname = 'Users can delete their workspace creators'
  ) THEN
    CREATE POLICY "Users can delete their workspace creators"
      ON public.workspace_creators FOR DELETE
      USING (workspace_id = auth.uid());
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.workspace_creators IS 'Junction table controlling which creators belong to which workspace (My Network ownership)';
COMMENT ON COLUMN public.workspace_creators.workspace_id IS 'Workspace that owns this creator (user_id = workspace_id)';
COMMENT ON COLUMN public.workspace_creators.creator_id IS 'Reference to the global creators table';
COMMENT ON COLUMN public.workspace_creators.source IS 'How this creator was added: scraper, csv, or manual';
