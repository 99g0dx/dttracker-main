-- ============================================================
-- QUICK SETUP: Create All Missing Tables for Creator Requests
-- ============================================================
-- This script creates the creator_requests and creator_request_items
-- tables with all necessary columns, indexes, triggers, and RLS policies.
-- Run this in Supabase SQL Editor if you're getting the error:
-- "Could not find the table 'public.creator_requests' in the schema cache"
-- ============================================================

-- Ensure the updated_at function exists (required for triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Creator requests table
CREATE TABLE IF NOT EXISTS public.creator_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'quoted', 'approved', 'in_fulfillment', 'delivered')),
  campaign_type TEXT CHECK (campaign_type IN ('music_promotion', 'brand_promotion', 'product_launch', 'event_activation', 'other')),
  campaign_brief TEXT,
  song_asset_links TEXT[],
  deliverables TEXT[],
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

-- Creator request items table
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
DROP TRIGGER IF EXISTS set_creator_requests_updated_at ON public.creator_requests;
CREATE TRIGGER set_creator_requests_updated_at
BEFORE UPDATE ON public.creator_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_creator_requests_user_id ON public.creator_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_requests_status ON public.creator_requests(status);
CREATE INDEX IF NOT EXISTS idx_creator_requests_created_at ON public.creator_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_request_items_request_id ON public.creator_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_creator_request_items_creator_id ON public.creator_request_items(creator_id);

-- ============================================================
-- RLS POLICIES - CREATOR_REQUESTS
-- ============================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own creator requests" ON public.creator_requests;
DROP POLICY IF EXISTS "Users can create their own creator requests" ON public.creator_requests;
DROP POLICY IF EXISTS "Users can update their own creator requests" ON public.creator_requests;

-- SELECT policy
CREATE POLICY "Users can view their own creator requests"
  ON public.creator_requests FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT policy
CREATE POLICY "Users can create their own creator requests"
  ON public.creator_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy (users can update their own requests)
-- Note: Status updates are typically handled by admin/service role
-- For now, allow users to update their own requests (status restrictions can be added later)
CREATE POLICY "Users can update their own creator requests"
  ON public.creator_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES - CREATOR_REQUEST_ITEMS
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view creator request items for their requests" ON public.creator_request_items;
DROP POLICY IF EXISTS "Users can insert creator request items for their requests" ON public.creator_request_items;
DROP POLICY IF EXISTS "Users can delete creator request items for their requests" ON public.creator_request_items;

-- SELECT policy
CREATE POLICY "Users can view creator request items for their requests"
  ON public.creator_request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_requests
      WHERE creator_requests.id = creator_request_items.request_id
      AND creator_requests.user_id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "Users can insert creator request items for their requests"
  ON public.creator_request_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creator_requests
      WHERE creator_requests.id = creator_request_items.request_id
      AND creator_requests.user_id = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "Users can delete creator request items for their requests"
  ON public.creator_request_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_requests
      WHERE creator_requests.id = creator_request_items.request_id
      AND creator_requests.user_id = auth.uid()
    )
  );
