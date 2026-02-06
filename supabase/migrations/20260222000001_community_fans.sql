-- Migration: Create community_fans table for imported fan/follower data
-- Allows users to import their fan base and create community-only activations

CREATE TABLE IF NOT EXISTS public.community_fans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  creator_id UUID REFERENCES public.creators(id) ON DELETE SET NULL,
  handle TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook')),
  name TEXT,
  follower_count INTEGER,
  email TEXT,
  phone TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_community_fans_workspace ON public.community_fans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_community_fans_platform ON public.community_fans(platform);
CREATE INDEX IF NOT EXISTS idx_community_fans_handle ON public.community_fans(handle);
CREATE INDEX IF NOT EXISTS idx_community_fans_creator ON public.community_fans(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_fans_workspace_platform ON public.community_fans(workspace_id, platform);

-- Unique constraint: one fan per workspace/platform/handle combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_fans_unique ON public.community_fans(workspace_id, platform, LOWER(handle));

-- FK to workspaces
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'community_fans_workspace_id_fkey') THEN
    ALTER TABLE public.community_fans
      ADD CONSTRAINT community_fans_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.community_fans ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can view their workspace's fans
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_fans' AND policyname = 'workspace_members_can_view_fans') THEN
    CREATE POLICY workspace_members_can_view_fans
      ON public.community_fans FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = community_fans.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- RLS: workspace members can insert fans
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_fans' AND policyname = 'workspace_members_can_insert_fans') THEN
    CREATE POLICY workspace_members_can_insert_fans
      ON public.community_fans FOR INSERT
      WITH CHECK (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = community_fans.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- RLS: workspace members can delete fans
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_fans' AND policyname = 'workspace_members_can_delete_fans') THEN
    CREATE POLICY workspace_members_can_delete_fans
      ON public.community_fans FOR DELETE
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = community_fans.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.community_fans IS 'Imported fan/follower data for community-only activations';
COMMENT ON COLUMN public.community_fans.workspace_id IS 'Workspace that imported this fan';
COMMENT ON COLUMN public.community_fans.creator_id IS 'Linked creator if fan matches existing creator in system';
COMMENT ON COLUMN public.community_fans.handle IS 'Social media handle/username';
COMMENT ON COLUMN public.community_fans.metadata IS 'Additional fan data stored as JSON';
