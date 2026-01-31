-- Migration: Create sound scrape jobs and results tables
-- This enables automated Apify scraping with webhook-based results

-- ============================================================
-- SOUND SCRAPE JOBS TABLE
-- ============================================================
-- Tracks Apify scrape jobs for sound tracking
CREATE TABLE IF NOT EXISTS public.sound_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_track_id UUID REFERENCES public.sound_tracks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'apify' CHECK (provider IN ('apify')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'failed')),
  
  -- Apify-specific fields
  input JSONB NOT NULL, -- { startUrls: [...], maxItems: 100, ... }
  run_id TEXT, -- Apify run ID once created
  dataset_id TEXT, -- Apify dataset ID for results
  
  -- Results metadata
  error TEXT,
  error_details JSONB,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deduplication: Prevent duplicate scrapes within 6 hours (handled in application logic)
-- Note: PostgreSQL doesn't support functional unique constraints easily, so we handle this in the Edge Function

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_sound_track_id ON public.sound_scrape_jobs(sound_track_id);
CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_workspace_id ON public.sound_scrape_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_status ON public.sound_scrape_jobs(status) WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_run_id ON public.sound_scrape_jobs(run_id) WHERE run_id IS NOT NULL;

-- ============================================================
-- SOUND TRACK STATS TABLE
-- ============================================================
-- Summary statistics for a sound (updated after each scrape)
CREATE TABLE IF NOT EXISTS public.sound_track_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_track_id UUID NOT NULL REFERENCES public.sound_tracks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  
  -- Aggregated stats
  total_uses INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  avg_likes INTEGER DEFAULT 0,
  avg_comments INTEGER DEFAULT 0,
  avg_shares INTEGER DEFAULT 0,
  
  -- Top performers
  top_video_views INTEGER DEFAULT 0,
  top_video_likes INTEGER DEFAULT 0,
  
  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  scrape_job_id UUID REFERENCES public.sound_scrape_jobs(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One stat record per sound track (latest)
  UNIQUE(sound_track_id)
);

CREATE INDEX IF NOT EXISTS idx_sound_track_stats_sound_track_id ON public.sound_track_stats(sound_track_id);
CREATE INDEX IF NOT EXISTS idx_sound_track_stats_workspace_id ON public.sound_track_stats(workspace_id);

-- ============================================================
-- SOUND TRACK VIDEOS TABLE
-- ============================================================
-- Individual videos using the sound (from Apify scrape results)
CREATE TABLE IF NOT EXISTS public.sound_track_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_track_id UUID NOT NULL REFERENCES public.sound_tracks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  
  -- Video identifiers
  video_id TEXT NOT NULL, -- Platform-specific video ID
  video_url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  
  -- Creator info
  creator_handle TEXT,
  creator_platform_id TEXT,
  creator_name TEXT,
  
  -- Metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Timestamps
  posted_at TIMESTAMPTZ, -- When video was posted on platform
  scraped_at TIMESTAMPTZ DEFAULT NOW(), -- When we scraped it
  
  -- Metadata
  scrape_job_id UUID REFERENCES public.sound_scrape_jobs(id) ON DELETE SET NULL,
  raw_data JSONB, -- Full Apify response for this video
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(sound_track_id, video_id, platform)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sound_track_videos_sound_track_id ON public.sound_track_videos(sound_track_id);
CREATE INDEX IF NOT EXISTS idx_sound_track_videos_workspace_id ON public.sound_track_videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sound_track_videos_views ON public.sound_track_videos(views DESC);
CREATE INDEX IF NOT EXISTS idx_sound_track_videos_posted_at ON public.sound_track_videos(posted_at DESC NULLS LAST);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.sound_scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_track_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_track_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sound_scrape_jobs
CREATE POLICY "Users can view jobs in their workspace"
  ON public.sound_scrape_jobs FOR SELECT
  USING (
    workspace_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.workspace_id = sound_scrape_jobs.workspace_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

CREATE POLICY "Users can create jobs in their workspace"
  ON public.sound_scrape_jobs FOR INSERT
  WITH CHECK (
    workspace_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.workspace_id = sound_scrape_jobs.workspace_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

-- RLS Policies for sound_track_stats
CREATE POLICY "Users can view stats in their workspace"
  ON public.sound_track_stats FOR SELECT
  USING (
    workspace_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.workspace_id = sound_track_stats.workspace_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

-- RLS Policies for sound_track_videos
CREATE POLICY "Users can view videos in their workspace"
  ON public.sound_track_videos FOR SELECT
  USING (
    workspace_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.workspace_id = sound_track_videos.workspace_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE TRIGGER update_sound_scrape_jobs_updated_at
  BEFORE UPDATE ON public.sound_scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_sound_track_stats_updated_at
  BEFORE UPDATE ON public.sound_track_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_sound_track_videos_updated_at
  BEFORE UPDATE ON public.sound_track_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
