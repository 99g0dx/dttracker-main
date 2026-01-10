-- ============================================================
-- QUICK FIX: Create Creator Requests Tables
-- ============================================================
-- Run this script in Supabase SQL Editor to create the
-- creator_requests and creator_request_items tables
-- ============================================================

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

-- Enable RLS
ALTER TABLE public.creator_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_request_items ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_requests_user_id ON public.creator_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_requests_status ON public.creator_requests(status);
CREATE INDEX IF NOT EXISTS idx_creator_requests_created_at ON public.creator_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_request_items_request_id ON public.creator_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_creator_request_items_creator_id ON public.creator_request_items(creator_id);

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

-- UPDATE (users can update their own requests - limited fields)
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
      WITH CHECK (
        auth.uid() = user_id AND
        -- Users can only update if status is still 'submitted' or 'reviewing'
        (OLD.status IN ('submitted', 'reviewing') AND NEW.status IN ('submitted', 'reviewing'))
      );
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
