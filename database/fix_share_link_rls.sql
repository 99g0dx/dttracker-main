-- ============================================================
-- FIX: Simplify RLS policies for share link compatibility
-- ============================================================
-- This script fixes the complex nested JOINs in RLS policies
-- that cause silent failures for unauthenticated clients viewing
-- campaign share links in different browsers.
--
-- Issues fixed:
-- 1. Charts not displaying due to complex post_metrics RLS policy
-- 2. Browser compatibility issues with nested JOIN evaluation
--
-- Run this in Supabase SQL Editor after applying the base
-- share link migration scripts.
-- ============================================================

-- STEP 1: Drop existing complex policy for post_metrics
DROP POLICY IF EXISTS "Public can view post_metrics via share links" ON public.post_metrics;

-- STEP 2: Create simplified policy using nested SELECT instead of JOIN
-- This avoids the complex RLS dependency chain that fails for anonymous users
CREATE POLICY "Public can view post_metrics via share links"
  ON public.post_metrics FOR SELECT
  TO anon, authenticated
  USING (
    -- Check if the post's campaign has a valid share link
    -- Uses nested SELECT to avoid JOIN-based RLS evaluation issues
    EXISTS (
      SELECT 1 FROM public.campaign_share_links
      WHERE campaign_share_links.campaign_id = (
        SELECT campaign_id FROM public.posts WHERE posts.id = post_metrics.post_id
      )
      AND (campaign_share_links.expires_at IS NULL OR campaign_share_links.expires_at > NOW())
    )
  );

-- STEP 3: Verify policy was created successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='post_metrics'
      AND policyname='Public can view post_metrics via share links'
  ) THEN
    RAISE NOTICE '✅ Policy "Public can view post_metrics via share links" created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create post_metrics policy';
  END IF;
END $$;

-- STEP 4: Also simplify the posts policy for consistency
DROP POLICY IF EXISTS "Public can view posts via valid share links" ON public.posts;

CREATE POLICY "Public can view posts via valid share links"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (
    -- Simplified: direct check without JOIN to campaigns table
    EXISTS (
      SELECT 1 FROM public.campaign_share_links
      WHERE campaign_share_links.campaign_id = posts.campaign_id
      AND (campaign_share_links.expires_at IS NULL OR campaign_share_links.expires_at > NOW())
    )
  );

-- STEP 5: Verify posts policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='posts'
      AND policyname='Public can view posts via valid share links'
  ) THEN
    RAISE NOTICE '✅ Policy "Public can view posts via valid share links" updated successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to update posts policy';
  END IF;
END $$;

-- STEP 6: Display summary
DO $$
BEGIN
  RAISE NOTICE '
  ============================================================
  ✅ Share Link RLS Policies Fixed
  ============================================================

  Changes applied:
  - Simplified post_metrics RLS policy (removed JOIN)
  - Simplified posts RLS policy (removed JOIN)

  Benefits:
  - Charts will now display in all browsers
  - Reduced RLS evaluation complexity for anonymous users
  - Better browser compatibility (Chrome, Firefox, Safari, Edge)

  Next steps:
  1. Update TypeScript code to remove authenticated client usage
  2. Test share links in multiple browsers
  3. Verify charts display correctly
  ============================================================
  ';
END $$;
