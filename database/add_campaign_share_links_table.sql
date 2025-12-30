-- Add campaign_share_links table for public/password-protected sharing
-- Run this script in your Supabase SQL Editor

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_share_links_campaign_id ON public.campaign_share_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_share_links_token ON public.campaign_share_links(share_token);

-- Enable RLS
ALTER TABLE public.campaign_share_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_share_links

-- SELECT (public can view share links by token, owners can view their share links)
-- Allow anonymous users to read share links (for public share link viewing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaign_share_links'
      AND policyname='Anyone can view share links'
  ) THEN
    CREATE POLICY "Anyone can view share links"
      ON public.campaign_share_links FOR SELECT
      USING (true);
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

