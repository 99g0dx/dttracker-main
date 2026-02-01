-- Enforce ban checks on self-scoped policies

-- Profiles: self access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND NOT public.is_user_banned(auth.uid()))
  WITH CHECK (auth.uid() = id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id AND NOT public.is_user_banned(auth.uid()));

-- User scraping quotas: self access
DROP POLICY IF EXISTS "Users can view their own quota" ON public.user_scraping_quotas;
CREATE POLICY "Users can view their own quota"
  ON public.user_scraping_quotas FOR SELECT
  USING (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own quota" ON public.user_scraping_quotas;
CREATE POLICY "Users can update their own quota"
  ON public.user_scraping_quotas FOR UPDATE
  USING (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

-- Creators: own records
DROP POLICY IF EXISTS "Users can insert their own creators" ON public.creators;
CREATE POLICY "Users can insert their own creators"
  ON public.creators FOR INSERT
  WITH CHECK ((user_id IS NOT NULL) AND (user_id = auth.uid()) AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own creators" ON public.creators;
CREATE POLICY "Users can update their own creators"
  ON public.creators FOR UPDATE
  USING ((user_id IS NOT NULL) AND (user_id = auth.uid()) AND NOT public.is_user_banned(auth.uid()))
  WITH CHECK ((user_id IS NOT NULL) AND (user_id = auth.uid()) AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own creators" ON public.creators;
CREATE POLICY "Users can delete their own creators"
  ON public.creators FOR DELETE
  USING ((user_id IS NOT NULL) AND (user_id = auth.uid()) AND NOT public.is_user_banned(auth.uid()));

-- Creator requests: self access
DROP POLICY IF EXISTS "Users can create their own creator requests" ON public.creator_requests;
CREATE POLICY "Users can create their own creator requests"
  ON public.creator_requests FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    AND NOT public.is_user_banned(auth.uid())
    AND (
      campaign_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.campaigns c
        WHERE c.id = creator_requests.campaign_id
          AND public.is_workspace_member(c.workspace_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own creator requests" ON public.creator_requests;
CREATE POLICY "Users can update their own creator requests"
  ON public.creator_requests FOR UPDATE
  USING (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own creator requests" ON public.creator_requests;
CREATE POLICY "Users can delete their own creator requests"
  ON public.creator_requests FOR DELETE
  USING (
    NOT public.is_user_banned(auth.uid())
    AND (
      (user_id = auth.uid() AND submission_type = 'suggestion' AND status = 'suggested')
      OR EXISTS (
        SELECT 1
        FROM public.campaigns c
        WHERE c.id = creator_requests.campaign_id
          AND public.is_workspace_owner(c.workspace_id, auth.uid())
      )
    )
  );

-- Creator request items: self access
DROP POLICY IF EXISTS "Users can insert creator request items for their requests" ON public.creator_request_items;
CREATE POLICY "Users can insert creator request items for their requests"
  ON public.creator_request_items FOR INSERT
  WITH CHECK (
    NOT public.is_user_banned(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.creator_requests
      WHERE creator_requests.id = creator_request_items.request_id
        AND creator_requests.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete creator request items for their requests" ON public.creator_request_items;
CREATE POLICY "Users can delete creator request items for their requests"
  ON public.creator_request_items FOR DELETE
  USING (
    NOT public.is_user_banned(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.creator_requests
      WHERE creator_requests.id = creator_request_items.request_id
        AND creator_requests.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view creator request items for their requests" ON public.creator_request_items;
CREATE POLICY "Users can view creator request items for their requests"
  ON public.creator_request_items FOR SELECT
  USING (
    NOT public.is_user_banned(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.creator_requests
      WHERE creator_requests.id = creator_request_items.request_id
        AND creator_requests.user_id = auth.uid()
    )
  );

-- Team invites: prevent banned users from accepting
DROP POLICY IF EXISTS "Invited user can accept invite" ON public.team_invites;
CREATE POLICY "Invited user can accept invite"
  ON public.team_invites FOR UPDATE
  USING (
    (email = (auth.jwt() ->> 'email')) AND accepted_at IS NULL AND NOT public.is_user_banned(auth.uid())
  )
  WITH CHECK (
    (email = (auth.jwt() ->> 'email')) AND accepted_at IS NOT NULL AND NOT public.is_user_banned(auth.uid())
  );
