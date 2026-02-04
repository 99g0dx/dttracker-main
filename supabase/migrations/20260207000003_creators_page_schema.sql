-- Migration: Creators page schema - creator_social_accounts, creator_stats, creator_favorites,
-- and extensions to creators + workspace_creators for My Network, Discover, Favorites.

-- ============================================================
-- 1. creator_social_accounts (multi-platform per creator)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creator_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook')),
  handle TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  verified_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_creator_social_accounts_creator ON public.creator_social_accounts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_social_accounts_platform ON public.creator_social_accounts(platform);

ALTER TABLE public.creator_social_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_social_accounts' AND policyname = 'creator_social_accounts_select_via_creator') THEN
    CREATE POLICY creator_social_accounts_select_via_creator
      ON public.creator_social_accounts FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.creators c
          WHERE c.id = creator_social_accounts.creator_id
        )
      );
  END IF;
END $$;

-- ============================================================
-- 2. creator_stats (aggregated from activations/posts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creator_stats (
  creator_id UUID PRIMARY KEY REFERENCES public.creators(id) ON DELETE CASCADE,
  avg_engagement_rate NUMERIC DEFAULT 0,
  campaigns_completed INTEGER DEFAULT 0,
  total_reach BIGINT DEFAULT 0,
  avg_views_per_post INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.creator_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_stats' AND policyname = 'creator_stats_select_via_creator') THEN
    CREATE POLICY creator_stats_select_via_creator
      ON public.creator_stats FOR SELECT
      USING (true);
  END IF;
END $$;

-- ============================================================
-- 3. creator_favorites (user favorites)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creator_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_favorites_user ON public.creator_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_favorites_creator ON public.creator_favorites(creator_id);

ALTER TABLE public.creator_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_favorites' AND policyname = 'creator_favorites_own') THEN
    CREATE POLICY creator_favorites_own
      ON public.creator_favorites FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 4. Extend creators table
-- ============================================================
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS dobble_tap_user_id UUID,
  ADD COLUMN IF NOT EXISTS profile_photo TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Make user_id nullable (for Dobble Tap synced creators)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'creators' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.creators ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- Drop old unique if it causes issues with nullable user_id
-- (user_id, handle, platform) - existing constraint may allow nulls
-- Leaving unique as-is; Postgres UNIQUE treats NULL as distinct, so multiple null user_ids are allowed

-- ============================================================
-- 5. Extend workspace_creators (manual-only entries)
-- ============================================================
ALTER TABLE public.workspace_creators
  ADD COLUMN IF NOT EXISTS manual_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_email TEXT,
  ADD COLUMN IF NOT EXISTS manual_phone TEXT,
  ADD COLUMN IF NOT EXISTS manual_handle TEXT,
  ADD COLUMN IF NOT EXISTS manual_platform TEXT CHECK (manual_platform IS NULL OR manual_platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook')),
  ADD COLUMN IF NOT EXISTS manual_followers INTEGER,
  ADD COLUMN IF NOT EXISTS manual_niche TEXT,
  ADD COLUMN IF NOT EXISTS manual_location TEXT,
  ADD COLUMN IF NOT EXISTS manual_base_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make creator_id nullable
DO $$
BEGIN
  ALTER TABLE public.workspace_creators ALTER COLUMN creator_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Constraint: either creator_id or (manual_handle + manual_platform)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_creators_creator_or_manual') THEN
    ALTER TABLE public.workspace_creators
      ADD CONSTRAINT workspace_creators_creator_or_manual
      CHECK (
        (creator_id IS NOT NULL) OR
        (manual_handle IS NOT NULL AND manual_platform IS NOT NULL)
      );
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ============================================================
-- 6. Backfill creator_stats from posts (activations table may not exist yet)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'posts') THEN
    INSERT INTO public.creator_stats (creator_id, avg_engagement_rate, campaigns_completed, total_reach, avg_views_per_post, updated_at)
    SELECT
      c.id,
      COALESCE((SELECT ROUND(AVG(p.engagement_rate)::numeric, 2) FROM public.posts p WHERE p.creator_id = c.id), 0),
      (SELECT COUNT(DISTINCT p.campaign_id) FROM public.posts p WHERE p.creator_id = c.id),
      (SELECT COALESCE(SUM(p.views), 0)::bigint FROM public.posts p WHERE p.creator_id = c.id),
      (SELECT ROUND(AVG(p.views))::int FROM public.posts p WHERE p.creator_id = c.id),
      NOW()
    FROM public.creators c
    WHERE NOT EXISTS (SELECT 1 FROM public.creator_stats cs WHERE cs.creator_id = c.id)
    ON CONFLICT (creator_id) DO NOTHING;
  END IF;
END $$;
