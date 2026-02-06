-- Chartmetric-style scrape queue: scrape_jobs, scrape_runs, parser_versions, creator data quality columns

-- ============================================================
-- 1. scrape_jobs (queue: what to scrape, when, retries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook')),
  job_type TEXT NOT NULL CHECK (job_type IN ('post', 'activation_submission')),
  reference_id UUID NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('post', 'activation_submission')),
  input JSONB NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'failed', 'cooldown')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  last_actor_id TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_jobs_reference
  ON public.scrape_jobs(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status_scheduled
  ON public.scrape_jobs(status, scheduled_for)
  WHERE status IN ('queued', 'cooldown');

-- ============================================================
-- 2. scrape_runs (every attempt: Apify run record)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.scrape_jobs(id) ON DELETE CASCADE,
  apify_run_id TEXT,
  actor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'timed_out')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INT,
  items_count INT,
  error_raw TEXT,
  raw_result_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_job ON public.scrape_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_actor ON public.scrape_runs(actor_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON public.scrape_runs(started_at);

-- ============================================================
-- 3. parser_versions (primary/fallback actor per platform)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parser_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'fallback')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, role)
);

INSERT INTO public.parser_versions (platform, actor_id, role)
VALUES
  ('tiktok', 'clockworks~tiktok-scraper', 'primary'),
  ('instagram', 'apify~instagram-scraper', 'primary'),
  ('youtube', 'streamers~youtube-scraper', 'primary'),
  ('twitter', 'rapidapi~twitter241', 'primary')
ON CONFLICT (platform, role) DO NOTHING;

-- ============================================================
-- 4. creators: data quality columns
-- ============================================================
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_status TEXT DEFAULT 'fresh' CHECK (data_status IN ('fresh', 'stale', 'failed')),
  ADD COLUMN IF NOT EXISTS last_successful_scrape_at TIMESTAMPTZ;

-- RLS: allow service role and company admins to read/write scrape_jobs and scrape_runs
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parser_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. For app: allow read for authenticated (admin check in app)
DROP POLICY IF EXISTS "Allow read scrape_jobs" ON public.scrape_jobs;
CREATE POLICY "Allow read scrape_jobs" ON public.scrape_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read scrape_runs" ON public.scrape_runs;
CREATE POLICY "Allow read scrape_runs" ON public.scrape_runs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read parser_versions" ON public.parser_versions;
CREATE POLICY "Allow read parser_versions" ON public.parser_versions FOR SELECT USING (true);

-- Only service role (Edge Functions) should insert/update scrape_jobs and scrape_runs
-- So no INSERT/UPDATE policy for anon/authenticated; Edge Functions use service_role key

-- Trigger to keep scrape_jobs.updated_at in sync
CREATE OR REPLACE FUNCTION public.set_scrape_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scrape_jobs_updated_at ON public.scrape_jobs;
CREATE TRIGGER scrape_jobs_updated_at
  BEFORE UPDATE ON public.scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_scrape_jobs_updated_at();
