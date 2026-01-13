-- Migration: Create agency_inventory table
-- This table controls which creators appear in the All Creators marketplace

-- Create agency_inventory table
CREATE TABLE IF NOT EXISTS public.agency_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  default_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  tags TEXT[],
  added_by_admin_user_id UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agency_inventory_creator_id ON public.agency_inventory(creator_id);
CREATE INDEX IF NOT EXISTS idx_agency_inventory_status ON public.agency_inventory(status);

-- Enable RLS
ALTER TABLE public.agency_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view active inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agency_inventory'
    AND policyname = 'Authenticated users can view active agency inventory'
  ) THEN
    CREATE POLICY "Authenticated users can view active agency inventory"
      ON public.agency_inventory FOR SELECT
      USING (auth.uid() IS NOT NULL AND status = 'active');
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.agency_inventory IS 'Controls which creators appear in the All Creators marketplace';
COMMENT ON COLUMN public.agency_inventory.creator_id IS 'Reference to the global creators table';
COMMENT ON COLUMN public.agency_inventory.status IS 'active = visible in marketplace, paused = hidden';
COMMENT ON COLUMN public.agency_inventory.added_by_admin_user_id IS 'Admin user who added this creator to the marketplace';
