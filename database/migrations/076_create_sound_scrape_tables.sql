-- Create sound_scrape_jobs table for tracking Apify scrape runs
CREATE TABLE IF NOT EXISTS public.sound_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_track_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'apify',
  status TEXT NOT NULL DEFAULT 'queued',
  input JSONB,
  run_id TEXT,
  dataset_id TEXT,
  error TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_sound_track ON sound_scrape_jobs(sound_track_id);
CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_run_id ON sound_scrape_jobs(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sound_scrape_jobs_status ON sound_scrape_jobs(status);

-- Enable RLS
ALTER TABLE public.sound_scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY sound_scrape_jobs_service_all ON public.sound_scrape_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to read their workspace jobs
CREATE POLICY sound_scrape_jobs_select ON public.sound_scrape_jobs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- Create sound_track_videos table for storing scraped videos
CREATE TABLE IF NOT EXISTS public.sound_track_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_track_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  video_id TEXT,
  video_url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'tiktok',
  creator_handle TEXT,
  creator_platform_id TEXT,
  creator_name TEXT,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  posted_at TIMESTAMPTZ,
  scrape_job_id UUID REFERENCES public.sound_scrape_jobs(id),
  raw_data JSONB,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert (onConflict: "sound_track_id,video_id,platform")
CREATE UNIQUE INDEX IF NOT EXISTS idx_sound_track_videos_upsert
  ON sound_track_videos(sound_track_id, video_id, platform);

CREATE INDEX IF NOT EXISTS idx_sound_track_videos_workspace ON sound_track_videos(workspace_id);

-- Enable RLS
ALTER TABLE public.sound_track_videos ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY sound_track_videos_service_all ON public.sound_track_videos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to read their workspace videos
CREATE POLICY sound_track_videos_select ON public.sound_track_videos
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- Create sound_track_stats TABLE (webhook upserts into this)
CREATE TABLE IF NOT EXISTS public.sound_track_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_track_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  total_uses INTEGER NOT NULL DEFAULT 0,
  total_videos INTEGER NOT NULL DEFAULT 0,
  avg_views BIGINT NOT NULL DEFAULT 0,
  avg_likes BIGINT NOT NULL DEFAULT 0,
  avg_comments BIGINT NOT NULL DEFAULT 0,
  avg_shares BIGINT NOT NULL DEFAULT 0,
  top_video_views BIGINT NOT NULL DEFAULT 0,
  top_video_likes BIGINT NOT NULL DEFAULT 0,
  scrape_job_id UUID REFERENCES public.sound_scrape_jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sound_track_id)
);

CREATE INDEX IF NOT EXISTS idx_sound_track_stats_workspace ON sound_track_stats(workspace_id);

-- Enable RLS
ALTER TABLE public.sound_track_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY sound_track_stats_service_all ON public.sound_track_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY sound_track_stats_select ON public.sound_track_stats
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
