-- ============================================================
-- FIX: Add Missing Columns to Campaigns Table
-- ============================================================
-- This script adds all missing columns that the application expects
-- but are not in the base schema.sql file
-- ============================================================

-- Add parent_campaign_id column (for subcampaigns)
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS parent_campaign_id UUID
REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Prevent self-referencing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_parent_not_self'
  ) THEN
    ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_parent_not_self
    CHECK (parent_campaign_id IS NULL OR parent_campaign_id <> id);
  END IF;
END
$$;

-- Index for fast subcampaign lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_parent_campaign_id
ON public.campaigns(parent_campaign_id);

-- Add share-related columns
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_allow_export BOOLEAN NOT NULL DEFAULT false;

-- Create index on share_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_share_token ON public.campaigns(share_token)
WHERE share_token IS NOT NULL;

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

-- Create trigger only if it doesn't exist
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

-- Create trigger only if it doesn't exist
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
