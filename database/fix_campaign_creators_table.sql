-- ============================================================
-- Fix: Create campaign_creators table if it doesn't exist
-- ============================================================
-- This script ensures the campaign_creators table exists with
-- proper structure, indexes, and RLS policies

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.campaign_creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, creator_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_campaign_creators_campaign_id ON public.campaign_creators(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_creators_creator_id ON public.campaign_creators(creator_id);

-- Enable Row Level Security
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
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
      WITH CHECK (
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
        AND EXISTS (
          SELECT 1 FROM public.creators
          WHERE creators.id = campaign_creators.creator_id
          AND creators.user_id = auth.uid()
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

