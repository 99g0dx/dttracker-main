-- SECURITY DEFINER helper: can_access_campaign(p_campaign_id, p_user_id)
-- Returns true if the user is the campaign owner OR a campaign_member.
-- Used in RLS policies on posts, campaign_creators, etc. to avoid
-- going through campaigns RLS (which only allows owner, causing shared members to be blocked).

CREATE OR REPLACE FUNCTION public.can_access_campaign(p_campaign_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND (
        c.user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = p_user_id
        )
      )
  );
$$;

-- Similarly for edit access (owner or editor member)
CREATE OR REPLACE FUNCTION public.can_edit_campaign(p_campaign_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND (
        c.user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id
            AND cm.user_id = p_user_id
            AND cm.role = 'editor'
        )
      )
  );
$$;

-- =============================================
-- Fix POSTS policies to use the helper
-- =============================================

DROP POLICY IF EXISTS "Users can view posts in campaigns they have access to" ON public.posts;
CREATE POLICY "Users can view posts in campaigns they have access to"
  ON public.posts FOR SELECT
  USING (public.can_access_campaign(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert posts in campaigns they own or edit" ON public.posts;
CREATE POLICY "Users can insert posts in campaigns they own or edit"
  ON public.posts FOR INSERT
  WITH CHECK (public.can_edit_campaign(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update posts in campaigns they own or edit" ON public.posts;
CREATE POLICY "Users can update posts in campaigns they own or edit"
  ON public.posts FOR UPDATE
  USING (public.can_edit_campaign(campaign_id, auth.uid()))
  WITH CHECK (public.can_edit_campaign(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete posts in campaigns they own or edit" ON public.posts;
CREATE POLICY "Users can delete posts in campaigns they own or edit"
  ON public.posts FOR DELETE
  USING (public.can_edit_campaign(campaign_id, auth.uid()));

-- =============================================
-- Fix CAMPAIGN_CREATORS policies to use the helper
-- =============================================

DROP POLICY IF EXISTS "Users can view campaign_creators for campaigns they have access to" ON public.campaign_creators;
CREATE POLICY "Users can view campaign_creators for campaigns they have access to"
  ON public.campaign_creators FOR SELECT
  USING (public.can_access_campaign(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert campaign_creators for campaigns they own or edit" ON public.campaign_creators;
CREATE POLICY "Users can insert campaign_creators for campaigns they own or edit"
  ON public.campaign_creators FOR INSERT
  WITH CHECK (public.can_edit_campaign(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete campaign_creators for campaigns they own or edit" ON public.campaign_creators;
CREATE POLICY "Users can delete campaign_creators for campaigns they own or edit"
  ON public.campaign_creators FOR DELETE
  USING (public.can_edit_campaign(campaign_id, auth.uid()));

-- =============================================
-- Fix CAMPAIGN_MEMBERS policies (view access uses can_access_campaign)
-- =============================================

DROP POLICY IF EXISTS "Users can view members of campaigns they have access to" ON public.campaign_members;
CREATE POLICY "Users can view members of campaigns they have access to"
  ON public.campaign_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.can_access_campaign(campaign_id, auth.uid())
  );
