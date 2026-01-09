-- Add RLS policies to allow public access to campaigns and posts via share links
-- This allows anonymous users to view campaigns/posts when they have a valid share link

-- ============================================================
-- PUBLIC ACCESS VIA SHARE LINKS
-- ============================================================

-- Allow public to view campaigns if they have a valid, non-expired share link
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='campaigns'
      AND policyname='Public can view campaigns via valid share links'
  ) THEN
    CREATE POLICY "Public can view campaigns via valid share links"
      ON public.campaigns FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.campaign_share_links
          WHERE campaign_share_links.campaign_id = campaigns.id
          AND (campaign_share_links.expires_at IS NULL OR campaign_share_links.expires_at > NOW())
        )
      );
  END IF;
END
$$;

-- Allow public to view posts if the campaign has a valid, non-expired share link
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='posts'
      AND policyname='Public can view posts via valid share links'
  ) THEN
    CREATE POLICY "Public can view posts via valid share links"
      ON public.posts FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.campaign_share_links
          INNER JOIN public.campaigns ON campaigns.id = campaign_share_links.campaign_id
          WHERE campaign_share_links.campaign_id = posts.campaign_id
          AND (campaign_share_links.expires_at IS NULL OR campaign_share_links.expires_at > NOW())
        )
      );
  END IF;
END
$$;

-- Allow public to view creators when viewing posts via share links
-- This is needed for the join in getCampaignByShareToken
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='creators'
      AND policyname='Public can view creators via share links'
  ) THEN
    CREATE POLICY "Public can view creators via share links"
      ON public.creators FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.posts
          INNER JOIN public.campaign_share_links ON campaign_share_links.campaign_id = posts.campaign_id
          WHERE posts.creator_id = creators.id
          AND (campaign_share_links.expires_at IS NULL OR campaign_share_links.expires_at > NOW())
        )
      );
  END IF;
END
$$;

-- Allow public to view post_metrics when viewing campaigns via share links
-- This is needed for charts/time series data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='post_metrics'
      AND policyname='Public can view post_metrics via share links'
  ) THEN
    CREATE POLICY "Public can view post_metrics via share links"
      ON public.post_metrics FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.posts
          INNER JOIN public.campaign_share_links ON campaign_share_links.campaign_id = posts.campaign_id
          WHERE post_metrics.post_id = posts.id
          AND (campaign_share_links.expires_at IS NULL OR campaign_share_links.expires_at > NOW())
        )
      );
  END IF;
END
$$;

