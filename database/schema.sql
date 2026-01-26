-- ============================================================
-- DTTracker Schema + RLS (SAFE TO RE-RUN)
-- Fixes: "policy already exists" by checking pg_policies first
-- ============================================================

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================

-- 2) Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  agency_role TEXT CHECK (agency_role IN ('agency', 'super_agency')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Keep updated_at fresh on updates
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_profiles_updated_at'
  ) THEN
    CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- 3) Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper for agency bypass checks
CREATE OR REPLACE FUNCTION public.has_agency_role(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = target_user_id
      AND p.agency_role IN ('agency', 'super_agency')
  );
$$;

-- 4) Profiles Policies (create only if missing)

-- SELECT: user can view their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='profiles'
      AND policyname='Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END
$$;

-- INSERT: user can create their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='profiles'
      AND policyname='Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

-- UPDATE: user can update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='profiles'
      AND policyname='Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

-- DELETE: user can delete their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='profiles'
      AND policyname='Users can delete their own profile'
  ) THEN
    CREATE POLICY "Users can delete their own profile"
      ON public.profiles
      FOR DELETE
      USING (auth.uid() = id);
  END IF;
END
$$;

-- ============================================================
-- CAMPAIGNS MVP SCHEMA
-- ============================================================

-- Creators table
CREATE TABLE IF NOT EXISTS public.creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook')),
  follower_count INTEGER DEFAULT 0,
  avg_engagement DECIMAL(5,2) DEFAULT 0,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, handle, platform)
);

-- Add email and phone columns if they don't exist (for existing databases)
ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS niche TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('manual', 'csv_import', 'scraper_extraction')) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS imported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_name TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  share_enabled BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  share_created_at TIMESTAMPTZ,
  share_expires_at TIMESTAMPTZ,
  share_allow_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT campaigns_parent_not_self CHECK (parent_campaign_id IS NULL OR parent_campaign_id <> id)
);

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook')),
  post_url TEXT NOT NULL,
  external_id TEXT,
  owner_username TEXT,
  posted_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scraped', 'failed', 'manual', 'scraping')),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post metrics history table (for time-series charts)
CREATE TABLE IF NOT EXISTS public.post_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign members table (for sharing/collaboration)
CREATE TABLE IF NOT EXISTS public.campaign_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

-- Campaign creators table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.campaign_creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, creator_id)
);

-- Team members table (for workspace team management)
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL, -- For now, this will be the owner's user_id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Team invites table (for pending invitations)
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invite_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  scopes JSONB DEFAULT '[]'::jsonb,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account events table (who did what)
CREATE TABLE IF NOT EXISTS public.account_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member scopes table (for granular permissions)
CREATE TABLE IF NOT EXISTS public.member_scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('workspace', 'campaign', 'calendar')),
  scope_value TEXT NOT NULL, -- 'editor'/'viewer' or campaign_id UUID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign share links table (for public/password-protected sharing)
CREATE TABLE IF NOT EXISTS public.campaign_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  is_password_protected BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

-- Creator requests table (for brands requesting creators from DTTracker's network)
CREATE TABLE IF NOT EXISTS public.creator_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'quoted', 'approved', 'in_fulfillment', 'delivered')),
  campaign_type TEXT CHECK (campaign_type IN ('music_promotion', 'brand_promotion', 'product_launch', 'event_activation', 'other')),
  campaign_brief TEXT,
  song_asset_links TEXT[], -- Array of URLs
  deliverables TEXT[], -- Array: tiktok_post, instagram_reel, instagram_story, youtube_short, other
  posts_per_creator INTEGER,
  usage_rights TEXT CHECK (usage_rights IN ('creator_page_only', 'repost_brand_pages', 'run_ads', 'all_above')),
  deadline DATE,
  urgency TEXT CHECK (urgency IN ('normal', 'fast_turnaround', 'asap')),
  contact_person_name TEXT,
  contact_person_email TEXT,
  contact_person_phone TEXT,
  quote_amount DECIMAL(10,2),
  quote_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator request items table (many-to-many relationship between requests and creators)
CREATE TABLE IF NOT EXISTS public.creator_request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.creator_requests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, creator_id)
);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================

-- Creators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_creators_updated_at'
  ) THEN
    CREATE TRIGGER set_creators_updated_at
    BEFORE UPDATE ON public.creators
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- Campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_campaigns_updated_at'
  ) THEN
    CREATE TRIGGER set_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- Prevent nested subcampaigns and ensure parent has no posts
CREATE OR REPLACE FUNCTION public.validate_campaign_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_campaign_id IS NOT NULL THEN
    -- Parent campaigns cannot themselves be subcampaigns
    IF EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE id = NEW.parent_campaign_id
      AND parent_campaign_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Subcampaigns cannot have subcampaigns';
    END IF;

    -- Parent campaigns cannot already have posts
    IF EXISTS (
      SELECT 1 FROM public.posts
      WHERE campaign_id = NEW.parent_campaign_id
    ) THEN
      RAISE EXCEPTION 'Parent campaigns cannot have posts';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_validate_campaign_parent'
  ) THEN
    CREATE TRIGGER trg_validate_campaign_parent
    BEFORE INSERT OR UPDATE OF parent_campaign_id ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_parent();
  END IF;
END
$$;

-- Prevent adding posts to parent campaigns
CREATE OR REPLACE FUNCTION public.prevent_posts_on_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.campaigns parent_campaign
    WHERE parent_campaign.id = NEW.campaign_id
    AND EXISTS (
      SELECT 1 FROM public.campaigns child_campaign
      WHERE child_campaign.parent_campaign_id = parent_campaign.id
    )
  ) THEN
    RAISE EXCEPTION 'Parent campaigns cannot have posts';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_prevent_posts_on_parent'
  ) THEN
    CREATE TRIGGER trg_prevent_posts_on_parent
    BEFORE INSERT OR UPDATE OF campaign_id ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.prevent_posts_on_parent();
  END IF;
END
$$;

-- Posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_posts_updated_at'
  ) THEN
    CREATE TRIGGER set_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- Creator Requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_creator_requests_updated_at'
  ) THEN
    CREATE TRIGGER set_creator_requests_updated_at
    BEFORE UPDATE ON public.creator_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_creators_user_id ON public.creators(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_platform ON public.creators(platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_parent_campaign_id ON public.campaigns(parent_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_share_token ON public.campaigns(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON public.posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_creator_id ON public.posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON public.posts(platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_campaign_platform_external_id ON public.posts(campaign_id, platform, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_post_metrics_post_id ON public.post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_scraped_at ON public.post_metrics(scraped_at);
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign_id ON public.campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON public.campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_creators_campaign_id ON public.campaign_creators(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_creators_creator_id ON public.campaign_creators(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_requests_user_id ON public.creator_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_requests_status ON public.creator_requests(status);
CREATE INDEX IF NOT EXISTS idx_creator_requests_created_at ON public.creator_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_request_items_request_id ON public.creator_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_creator_request_items_creator_id ON public.creator_request_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_team_members_workspace_id ON public.team_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_workspace_id ON public.team_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_account_events_workspace_id ON public.account_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_account_events_actor_id ON public.account_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_account_events_created_at ON public.account_events(created_at);
CREATE INDEX IF NOT EXISTS idx_member_scopes_team_member_id ON public.member_scopes(team_member_id);
CREATE INDEX IF NOT EXISTS idx_campaign_share_links_campaign_id ON public.campaign_share_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_share_links_token ON public.campaign_share_links(share_token);

-- ============================================================
-- ROW LEVEL SECURITY - ENABLE
-- ============================================================

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_request_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY - CREATORS POLICIES
-- ============================================================

-- SELECT (users can view their own creators)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creators'
      AND policyname='Users can view their own creators'
  ) THEN
    CREATE POLICY "Users can view their own creators"
      ON public.creators FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- SELECT (all authenticated users can view all creators - for "All Creators" tab)
-- This allows brands to browse DTTracker's wider network
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creators'
      AND policyname='Authenticated users can view all creators'
  ) THEN
    CREATE POLICY "Authenticated users can view all creators"
      ON public.creators FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END
$$;

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creators'
      AND policyname='Users can insert their own creators'
  ) THEN
    CREATE POLICY "Users can insert their own creators"
      ON public.creators FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creators'
      AND policyname='Users can update their own creators'
  ) THEN
    CREATE POLICY "Users can update their own creators"
      ON public.creators FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creators'
      AND policyname='Users can delete their own creators'
  ) THEN
    CREATE POLICY "Users can delete their own creators"
      ON public.creators FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - CAMPAIGNS POLICIES
-- ============================================================

-- SELECT (owner only - simplified to avoid recursion)
-- Note: Shared campaigns access can be added via a separate policy or function if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaigns'
      AND policyname='Users can view their own campaigns'
  ) THEN
    CREATE POLICY "Users can view their own campaigns"
      ON public.campaigns FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaigns'
      AND policyname='Users can insert their own campaigns'
  ) THEN
    CREATE POLICY "Users can insert their own campaigns"
      ON public.campaigns FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- UPDATE (owner only - simplified to avoid recursion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaigns'
      AND policyname='Users can update their own campaigns'
  ) THEN
    CREATE POLICY "Users can update their own campaigns"
      ON public.campaigns FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- DELETE (owner only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaigns'
      AND policyname='Users can delete their own campaigns'
  ) THEN
    CREATE POLICY "Users can delete their own campaigns"
      ON public.campaigns FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - CAMPAIGN_CREATORS POLICIES
-- ============================================================

-- SELECT (users can view campaign_creators for campaigns they have access to)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_creators'
      AND policyname='Users can view campaign_creators for campaigns they have access to'
  ) THEN
    CREATE POLICY "Users can view campaign_creators for campaigns they have access to"
      ON public.campaign_creators FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_creators.campaign_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
            )
          )
        )
        AND EXISTS (
          SELECT 1 FROM public.creators
          WHERE creators.id = campaign_creators.creator_id
          AND creators.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- INSERT (users can add creators to campaigns they own or edit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_creators'
      AND policyname='Users can insert campaign_creators for campaigns they own or edit'
  ) THEN
    CREATE POLICY "Users can insert campaign_creators for campaigns they own or edit"
      ON public.campaign_creators FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.campaigns c
          WHERE c.id = campaign_creators.campaign_id
          AND (
            c.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members cm
              WHERE cm.campaign_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'editor')
            )
          )
        )
        AND EXISTS (
          SELECT 1 FROM public.creators cr
          WHERE cr.id = campaign_creators.creator_id
          AND (
            cr.user_id = auth.uid()
            OR cr.user_id IS NULL
            OR EXISTS (
              SELECT 1 FROM public.workspace_creators wc
              WHERE wc.creator_id = cr.id
              AND wc.workspace_id = (
                SELECT c.workspace_id
                FROM public.campaigns c
                WHERE c.id = campaign_creators.campaign_id
              )
            )
          )
        )
      );
  END IF;
END
$$;

-- DELETE (users can remove creators from campaigns they own or edit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_creators'
      AND policyname='Users can delete campaign_creators for campaigns they own or edit'
  ) THEN
    CREATE POLICY "Users can delete campaign_creators for campaigns they own or edit"
      ON public.campaign_creators FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_creators.campaign_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
              AND campaign_members.role IN ('owner', 'editor')
            )
          )
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - CREATOR_REQUESTS POLICIES
-- ============================================================

-- SELECT (users can view their own requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_requests'
      AND policyname='Users can view their own creator requests'
  ) THEN
    CREATE POLICY "Users can view their own creator requests"
      ON public.creator_requests FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- INSERT (users can create their own requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_requests'
      AND policyname='Users can create their own creator requests'
  ) THEN
    CREATE POLICY "Users can create their own creator requests"
      ON public.creator_requests FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- UPDATE (users can update their own requests)
-- Note: Status updates can be restricted later if needed via application logic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_requests'
      AND policyname='Users can update their own creator requests'
  ) THEN
    CREATE POLICY "Users can update their own creator requests"
      ON public.creator_requests FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - CREATOR_REQUEST_ITEMS POLICIES
-- ============================================================

-- SELECT (users can view items for their own requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_request_items'
      AND policyname='Users can view creator request items for their requests'
  ) THEN
    CREATE POLICY "Users can view creator request items for their requests"
      ON public.creator_request_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.creator_requests
          WHERE creator_requests.id = creator_request_items.request_id
          AND creator_requests.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- INSERT (users can add items to their own requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_request_items'
      AND policyname='Users can insert creator request items for their requests'
  ) THEN
    CREATE POLICY "Users can insert creator request items for their requests"
      ON public.creator_request_items FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.creator_requests
          WHERE creator_requests.id = creator_request_items.request_id
          AND creator_requests.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- DELETE (users can remove items from their own requests)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creator_request_items'
      AND policyname='Users can delete creator request items for their requests'
  ) THEN
    CREATE POLICY "Users can delete creator request items for their requests"
      ON public.creator_request_items FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.creator_requests
          WHERE creator_requests.id = creator_request_items.request_id
          AND creator_requests.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - POSTS POLICIES
-- ============================================================

-- SELECT (follow campaign access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='posts'
      AND policyname='Users can view posts in campaigns they have access to'
  ) THEN
    CREATE POLICY "Users can view posts in campaigns they have access to"
      ON public.posts FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = posts.campaign_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
            )
          )
        )
      );
  END IF;
END
$$;

-- INSERT (owner + editors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='posts'
      AND policyname='Users can insert posts in campaigns they own or edit'
  ) THEN
    CREATE POLICY "Users can insert posts in campaigns they own or edit"
      ON public.posts FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = posts.campaign_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
              AND campaign_members.role IN ('owner', 'editor')
            )
          )
        )
      );
  END IF;
END
$$;

-- UPDATE (owner + editors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='posts'
      AND policyname='Users can update posts in campaigns they own or edit'
  ) THEN
    CREATE POLICY "Users can update posts in campaigns they own or edit"
      ON public.posts FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = posts.campaign_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
              AND campaign_members.role IN ('owner', 'editor')
            )
          )
        )
      );
  END IF;
END
$$;

-- DELETE (owner + editors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='posts'
      AND policyname='Users can delete posts in campaigns they own or edit'
  ) THEN
    CREATE POLICY "Users can delete posts in campaigns they own or edit"
      ON public.posts FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = posts.campaign_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
              AND campaign_members.role IN ('owner', 'editor')
            )
          )
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - POST_METRICS POLICIES
-- ============================================================

-- SELECT (follow posts access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='post_metrics'
      AND policyname='Users can view post metrics for posts they have access to'
  ) THEN
    CREATE POLICY "Users can view post metrics for posts they have access to"
      ON public.post_metrics FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.posts
          JOIN public.campaigns ON campaigns.id = posts.campaign_id
          WHERE posts.id = post_metrics.post_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
            )
          )
        )
      );
  END IF;
END
$$;

-- INSERT (owner + editors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='post_metrics'
      AND policyname='Users can insert post metrics for posts they have access to'
  ) THEN
    CREATE POLICY "Users can insert post metrics for posts they have access to"
      ON public.post_metrics FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.posts
          JOIN public.campaigns ON campaigns.id = posts.campaign_id
          WHERE posts.id = post_metrics.post_id
          AND (
            campaigns.user_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.campaign_members
              WHERE campaign_members.campaign_id = campaigns.id
              AND campaign_members.user_id = auth.uid()
              AND campaign_members.role IN ('owner', 'editor')
            )
          )
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - CAMPAIGN_MEMBERS POLICIES
-- ============================================================

-- SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_members'
      AND policyname='Users can view members of campaigns they have access to'
  ) THEN
    CREATE POLICY "Users can view members of campaigns they have access to"
      ON public.campaign_members FOR SELECT
      USING (
        auth.uid() = user_id OR
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_members.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ALL (INSERT, UPDATE, DELETE - campaign owners only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_members'
      AND policyname='Campaign owners can manage members'
  ) THEN
    CREATE POLICY "Campaign owners can manage members"
      ON public.campaign_members FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_members.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - TEAM_MEMBERS POLICIES
-- ============================================================

-- SELECT (users can view team members in their workspace)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_members'
      AND policyname='Users can view team members in their workspace'
  ) THEN
    CREATE POLICY "Users can view team members in their workspace"
      ON public.team_members FOR SELECT
      USING (workspace_id = auth.uid() OR user_id = auth.uid());
  END IF;
END
$$;

-- INSERT (workspace owner can add team members)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_members'
      AND policyname='Workspace owner can add team members'
  ) THEN
    CREATE POLICY "Workspace owner can add team members"
      ON public.team_members FOR INSERT
      WITH CHECK (workspace_id = auth.uid() AND invited_by = auth.uid());
  END IF;
END
$$;

-- INSERT (invited user can add themselves via valid invite)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_members'
      AND policyname='team_members_insert_from_invite_email'
  ) THEN
    CREATE POLICY "team_members_insert_from_invite_email"
      ON public.team_members FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.team_invites ti
          WHERE ti.workspace_id = team_members.workspace_id
            AND ti.email = (auth.jwt() ->> 'email')
            AND ti.accepted_at IS NULL
            AND ti.expires_at > now()
        )
      );
  END IF;
END
$$;

-- UPDATE (workspace owner can update team members)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_members'
      AND policyname='Workspace owner can update team members'
  ) THEN
    CREATE POLICY "Workspace owner can update team members"
      ON public.team_members FOR UPDATE
      USING (workspace_id = auth.uid())
      WITH CHECK (workspace_id = auth.uid());
  END IF;
END
$$;

-- DELETE (workspace owner can remove team members)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_members'
      AND policyname='Workspace owner can remove team members'
  ) THEN
    CREATE POLICY "Workspace owner can remove team members"
      ON public.team_members FOR DELETE
      USING (workspace_id = auth.uid());
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - TEAM_INVITES POLICIES
-- ============================================================

-- SELECT (users can view invites for their workspace or their own invites)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_invites'
      AND policyname='Users can view invites for their workspace'
  ) THEN
    CREATE POLICY "Users can view invites for their workspace"
      ON public.team_invites FOR SELECT
      USING (workspace_id = auth.uid() OR email = (auth.jwt() ->> 'email'));
  END IF;
END
$$;

-- INSERT (workspace owner can create invites)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_invites'
      AND policyname='Workspace owner can create invites'
  ) THEN
    CREATE POLICY "Workspace owner can create invites"
      ON public.team_invites FOR INSERT
      WITH CHECK (workspace_id = auth.uid() AND invited_by = auth.uid());
  END IF;
END
$$;

-- UPDATE (workspace owner can update invites, public can accept)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_invites'
      AND policyname='Workspace owner can update invites'
  ) THEN
    CREATE POLICY "Workspace owner can update invites"
      ON public.team_invites FOR UPDATE
      USING (workspace_id = auth.uid())
      WITH CHECK (workspace_id = auth.uid());
  END IF;
END
$$;

-- UPDATE (invited user can accept)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_invites'
      AND policyname='Invited user can accept invite'
  ) THEN
    CREATE POLICY "Invited user can accept invite"
      ON public.team_invites FOR UPDATE
      USING (email = (auth.jwt() ->> 'email') AND accepted_at IS NULL)
      WITH CHECK (email = (auth.jwt() ->> 'email') AND accepted_at IS NOT NULL);
  END IF;
END
$$;

-- DELETE (workspace owner can delete invites)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='team_invites'
      AND policyname='Workspace owner can delete invites'
  ) THEN
    CREATE POLICY "Workspace owner can delete invites"
      ON public.team_invites FOR DELETE
      USING (workspace_id = auth.uid());
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - ACCOUNT_EVENTS POLICIES
-- ============================================================

-- SELECT (workspace owner can view events)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='account_events'
      AND policyname='Account owner can view events'
  ) THEN
    CREATE POLICY "Account owner can view events"
      ON public.account_events FOR SELECT
      USING (workspace_id = auth.uid());
  END IF;
END
$$;

-- SELECT (actors can view their own events)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='account_events'
      AND policyname='Actors can view their own events'
  ) THEN
    CREATE POLICY "Actors can view their own events"
      ON public.account_events FOR SELECT
      USING (actor_id = auth.uid());
  END IF;
END
$$;

-- INSERT (members can add events for workspaces they belong to)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='account_events'
      AND policyname='Members can insert events'
  ) THEN
    CREATE POLICY "Members can insert events"
      ON public.account_events FOR INSERT
      WITH CHECK (
        actor_id = auth.uid()
        AND (
          workspace_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.team_members tm
            WHERE tm.workspace_id = account_events.workspace_id
              AND tm.user_id = auth.uid()
              AND tm.status = 'active'
          )
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - MEMBER_SCOPES POLICIES
-- ============================================================

-- SELECT (users can view scopes for team members in their workspace)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_scopes'
      AND policyname='Users can view scopes for team members in their workspace'
  ) THEN
    CREATE POLICY "Users can view scopes for team members in their workspace"
      ON public.member_scopes FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.team_members
          WHERE team_members.id = member_scopes.team_member_id
          AND (team_members.workspace_id = auth.uid() OR team_members.user_id = auth.uid())
        )
      );
  END IF;
END
$$;

-- INSERT (workspace owner can add scopes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_scopes'
      AND policyname='Workspace owner can add scopes'
  ) THEN
    CREATE POLICY "Workspace owner can add scopes"
      ON public.member_scopes FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.team_members
          WHERE team_members.id = member_scopes.team_member_id
          AND team_members.workspace_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- INSERT (invited user can add their scopes during acceptance)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_scopes'
      AND policyname='Invited user can add their scopes'
  ) THEN
    CREATE POLICY "Invited user can add their scopes"
      ON public.member_scopes FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.team_members tm
          WHERE tm.id = member_scopes.team_member_id
            AND tm.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM public.team_invites ti
          WHERE ti.workspace_id = (
            SELECT tm.workspace_id
            FROM public.team_members tm
            WHERE tm.id = member_scopes.team_member_id
          )
            AND ti.email = (auth.jwt() ->> 'email')
            AND ti.accepted_at IS NULL
            AND ti.expires_at > now()
        )
      );
  END IF;
END
$$;

-- DELETE (workspace owner can remove scopes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_scopes'
      AND policyname='Workspace owner can remove scopes'
  ) THEN
    CREATE POLICY "Workspace owner can remove scopes"
      ON public.member_scopes FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.team_members
          WHERE team_members.id = member_scopes.team_member_id
          AND team_members.workspace_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY - CAMPAIGN_SHARE_LINKS POLICIES
-- ============================================================

-- SELECT (public can view share links by token, owners can view their share links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_share_links'
      AND policyname='Public can view share links by token or owners can view their links'
  ) THEN
    CREATE POLICY "Public can view share links by token or owners can view their links"
      ON public.campaign_share_links FOR SELECT
      USING (
        -- Public access (no auth required) - this will be handled by service role in API
        true
        OR
        -- Owners can view their own share links
        created_by = auth.uid()
        OR
        -- Campaign owners can view share links for their campaigns
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_share_links.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- INSERT (campaign owners can create share links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_share_links'
      AND policyname='Campaign owners can create share links'
  ) THEN
    CREATE POLICY "Campaign owners can create share links"
      ON public.campaign_share_links FOR INSERT
      WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_share_links.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- UPDATE (campaign owners can update their share links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_share_links'
      AND policyname='Campaign owners can update their share links'
  ) THEN
    CREATE POLICY "Campaign owners can update their share links"
      ON public.campaign_share_links FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_share_links.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_share_links.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- DELETE (campaign owners can delete their share links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_share_links'
      AND policyname='Campaign owners can delete their share links'
  ) THEN
    CREATE POLICY "Campaign owners can delete their share links"
      ON public.campaign_share_links FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = campaign_share_links.campaign_id
          AND campaigns.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- STORAGE BUCKET FOR CAMPAIGN COVERS
-- ============================================================

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-covers', 'campaign-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for campaign covers

-- Authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated users can upload campaign covers'
  ) THEN
    CREATE POLICY "Authenticated users can upload campaign covers"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'campaign-covers');
  END IF;
END
$$;

-- Users can update their own covers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Users can update their own campaign covers'
  ) THEN
    CREATE POLICY "Users can update their own campaign covers"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'campaign-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END
$$;

-- Users can delete their own covers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Users can delete their own campaign covers'
  ) THEN
    CREATE POLICY "Users can delete their own campaign covers"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'campaign-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END
$$;

-- Public can view covers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Campaign covers are publicly accessible'
  ) THEN
    CREATE POLICY "Campaign covers are publicly accessible"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'campaign-covers');
  END IF;
END
$$;

-- ============================================================
-- SOUND TRACKING TABLES (Migration 038)
-- ============================================================

-- Create sounds table
CREATE TABLE IF NOT EXISTS public.sounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  canonical_sound_key TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  source TEXT,
  sound_page_url TEXT,
  last_crawled_at TIMESTAMPTZ,
  indexing_state TEXT NOT NULL DEFAULT 'queued' CHECK (indexing_state IN ('queued', 'indexing', 'active', 'failed')),
  geo_estimated JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sounds_unique_per_platform UNIQUE(platform, canonical_sound_key)
);

-- Create sound_videos table
CREATE TABLE IF NOT EXISTS public.sound_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_id UUID NOT NULL REFERENCES public.sounds(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  creator_handle TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  posted_at TIMESTAMPTZ,
  bucket TEXT DEFAULT 'top' CHECK (bucket IN ('top', 'recent', 'trending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sound_videos_unique UNIQUE(sound_id, video_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sounds_user_id ON public.sounds(user_id);
CREATE INDEX IF NOT EXISTS idx_sounds_platform_key ON public.sounds(platform, canonical_sound_key);
CREATE INDEX IF NOT EXISTS idx_sounds_last_crawled ON public.sounds(last_crawled_at);
CREATE INDEX IF NOT EXISTS idx_sound_videos_sound_id ON public.sound_videos(sound_id);
CREATE INDEX IF NOT EXISTS idx_sound_videos_views ON public.sound_videos(views DESC);
CREATE INDEX IF NOT EXISTS idx_sound_videos_engagement ON public.sound_videos(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_sound_videos_posted_at ON public.sound_videos(posted_at DESC);

-- Enable RLS
ALTER TABLE public.sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sounds - users can only access their own sounds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sounds' AND policyname='Users can view their own sounds'
  ) THEN
    CREATE POLICY "Users can view their own sounds"
      ON public.sounds FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sounds' AND policyname='Users can insert their own sounds'
  ) THEN
    CREATE POLICY "Users can insert their own sounds"
      ON public.sounds FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sounds' AND policyname='Users can update their own sounds'
  ) THEN
    CREATE POLICY "Users can update their own sounds"
      ON public.sounds FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sounds' AND policyname='Users can delete their own sounds'
  ) THEN
    CREATE POLICY "Users can delete their own sounds"
      ON public.sounds FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- RLS Policies for sound_videos - inherit access from parent sound
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sound_videos' AND policyname='Users can view videos from their sounds'
  ) THEN
    CREATE POLICY "Users can view videos from their sounds"
      ON public.sound_videos FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.sounds
          WHERE sounds.id = sound_videos.sound_id
          AND sounds.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sound_videos' AND policyname='Users can insert videos to their sounds'
  ) THEN
    CREATE POLICY "Users can insert videos to their sounds"
      ON public.sound_videos FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.sounds
          WHERE sounds.id = sound_videos.sound_id
          AND sounds.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sound_videos' AND policyname='Users can update videos from their sounds'
  ) THEN
    CREATE POLICY "Users can update videos from their sounds"
      ON public.sound_videos FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.sounds
          WHERE sounds.id = sound_videos.sound_id
          AND sounds.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sound_videos' AND policyname='Users can delete videos from their sounds'
  ) THEN
    CREATE POLICY "Users can delete videos from their sounds"
      ON public.sound_videos FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.sounds
          WHERE sounds.id = sound_videos.sound_id
          AND sounds.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- Create trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_sounds_updated_at'
  ) THEN
    CREATE FUNCTION update_sounds_updated_at()
    RETURNS TRIGGER AS $inner$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $inner$ LANGUAGE plpgsql;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sounds_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_sounds_updated_at_trigger BEFORE UPDATE ON public.sounds
      FOR EACH ROW EXECUTE FUNCTION update_sounds_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sound_videos_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_sound_videos_updated_at_trigger BEFORE UPDATE ON public.sound_videos
      FOR EACH ROW EXECUTE FUNCTION update_sounds_updated_at();
  END IF;
END
$$;

-- ============================================================
-- ADD SOUND FIELDS TO CAMPAIGNS (Migration 039)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='campaigns' AND column_name='sound_id'
  ) THEN
    ALTER TABLE public.campaigns
    ADD COLUMN sound_url TEXT,
    ADD COLUMN sound_id UUID REFERENCES public.sounds(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_campaigns_sound_id'
  ) THEN
    CREATE INDEX idx_campaigns_sound_id ON public.campaigns(sound_id);
  END IF;
END
$$;

-- ============================================================
-- SOUND REFRESH QUEUE (Migration 040)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sound_refresh_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sound_id UUID NOT NULL REFERENCES public.sounds(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'ingest' CHECK (action IN ('ingest', 'refresh')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INT DEFAULT 0,
  error_message TEXT,
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_status ON public.sound_refresh_queue(status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_priority ON public.sound_refresh_queue(priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_next_retry ON public.sound_refresh_queue(next_retry_at)
  WHERE status = 'failed' AND attempt_count < max_attempts;

CREATE INDEX IF NOT EXISTS idx_sound_refresh_queue_sound_id ON public.sound_refresh_queue(sound_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_sound_refresh_queue_updated_at'
  ) THEN
    CREATE FUNCTION update_sound_refresh_queue_updated_at()
    RETURNS TRIGGER AS $inner$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $inner$ LANGUAGE plpgsql;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_sound_refresh_queue_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_sound_refresh_queue_updated_at_trigger BEFORE UPDATE ON public.sound_refresh_queue
      FOR EACH ROW EXECUTE FUNCTION update_sound_refresh_queue_updated_at();
  END IF;
END
$$;

ALTER TABLE public.sound_refresh_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='sound_refresh_queue' AND policyname='Service role can manage queue'
  ) THEN
    CREATE POLICY "Service role can manage queue"
      ON public.sound_refresh_queue
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
