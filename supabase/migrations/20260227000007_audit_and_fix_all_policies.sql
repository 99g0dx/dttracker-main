-- Audit: drop ALL existing policies on posts, campaign_creators, campaign_members
-- that reference campaigns table inline (causes RLS chain issues for shared members).
-- Then recreate them using the SECURITY DEFINER helpers.

-- Drop ALL existing SELECT/INSERT/UPDATE/DELETE policies on posts
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='posts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', pol.policyname);
  END LOOP;
END $$;

-- Recreate posts policies using SECURITY DEFINER helpers
CREATE POLICY "posts_select" ON public.posts FOR SELECT
  USING (public.can_access_campaign(campaign_id, auth.uid()));

CREATE POLICY "posts_insert" ON public.posts FOR INSERT
  WITH CHECK (public.can_edit_campaign(campaign_id, auth.uid()));

CREATE POLICY "posts_update" ON public.posts FOR UPDATE
  USING (public.can_edit_campaign(campaign_id, auth.uid()))
  WITH CHECK (public.can_edit_campaign(campaign_id, auth.uid()));

CREATE POLICY "posts_delete" ON public.posts FOR DELETE
  USING (public.can_edit_campaign(campaign_id, auth.uid()));

-- Drop ALL existing policies on campaign_creators
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaign_creators'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaign_creators', pol.policyname);
  END LOOP;
END $$;

-- Recreate campaign_creators policies
CREATE POLICY "campaign_creators_select" ON public.campaign_creators FOR SELECT
  USING (public.can_access_campaign(campaign_id, auth.uid()));

CREATE POLICY "campaign_creators_insert" ON public.campaign_creators FOR INSERT
  WITH CHECK (public.can_edit_campaign(campaign_id, auth.uid()));

CREATE POLICY "campaign_creators_delete" ON public.campaign_creators FOR DELETE
  USING (public.can_edit_campaign(campaign_id, auth.uid()));

-- Drop ALL existing policies on campaign_members
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaign_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaign_members', pol.policyname);
  END LOOP;
END $$;

-- Recreate campaign_members policies
CREATE POLICY "campaign_members_select" ON public.campaign_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.can_access_campaign(campaign_id, auth.uid())
  );

CREATE POLICY "campaign_members_manage" ON public.campaign_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_members.campaign_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_members.campaign_id
        AND c.user_id = auth.uid()
    )
  );
