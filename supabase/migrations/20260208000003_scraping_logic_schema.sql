-- Migration: Scraping logic schema - initial scrape flags, growth tracking, scheduled scraping support

-- ============================================
-- Posts table (Campaign Tracking)
-- ============================================

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS initial_scrape_attempted BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS initial_scrape_completed BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS initial_scrape_failed BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS initial_scraped_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS scrape_count INTEGER DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS scrape_errors JSONB DEFAULT '[]';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS last_view_growth INTEGER;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS last_like_growth INTEGER;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS last_comment_growth INTEGER;

-- Index for scheduled scraping queries
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_scraping
  ON public.posts(campaign_id, initial_scrape_completed, last_scraped_at);

-- ============================================
-- Activation Submissions table (Contests)
-- ============================================

ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS initial_scrape_completed BOOLEAN DEFAULT false;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS scrape_count INTEGER DEFAULT 0;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS scrape_errors JSONB DEFAULT '[]';

-- Index for scheduled scraping
CREATE INDEX IF NOT EXISTS idx_submissions_scraping
  ON public.activation_submissions(activation_id, status, last_scraped_at)
  WHERE status = 'approved';

-- Backfill: existing scraped posts treated as having completed initial scrape
UPDATE public.posts
SET initial_scrape_attempted = true,
    initial_scrape_completed = true
WHERE status IN ('scraped', 'manual')
  AND (initial_scrape_completed IS NULL OR initial_scrape_completed = false);
