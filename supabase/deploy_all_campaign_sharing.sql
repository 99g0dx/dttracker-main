-- ============================================================
-- DEPLOY ALL CAMPAIGN SHARING FUNCTIONS + FIX RLS POLICIES
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- =============================================
-- 1. Drop the broken RLS policy on campaigns (infinite recursion fix)
-- =============================================
DROP POLICY IF EXISTS "Campaign members can view shared campaigns" ON public.campaigns;

-- =============================================
-- 2. SECURITY DEFINER helper functions
-- =============================================

CREATE OR REPLACE FUNCTION public.is_campaign_member(p_campaign_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id
      AND user_id = p_user_id
  );
$$;

-- can_access_campaign: owner OR campaign_member (any role)
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

-- can_edit_campaign: owner OR campaign_member with role=editor
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
-- 3. Fix campaign_members RLS policies (use SECURITY DEFINER helpers)
-- =============================================

-- Drop ALL existing campaign_members policies and recreate
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaign_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaign_members', pol.policyname);
  END LOOP;
END $$;

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

-- =============================================
-- 4. Subscription check (needed by add_campaign_member_by_email)
-- =============================================
CREATE OR REPLACE FUNCTION public.check_users_subscription_status(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  uid uuid;
  v_workspace_id uuid;
  v_status text;
  v_period_end timestamptz;
  v_active boolean;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN result;
  END IF;

  FOREACH uid IN ARRAY p_user_ids
  LOOP
    v_active := false;

    IF public.has_agency_role(uid) THEN
      v_active := true;
    ELSE
      SELECT wm.workspace_id INTO v_workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = uid
      LIMIT 1;

      IF v_workspace_id IS NULL THEN
        SELECT w.id INTO v_workspace_id
        FROM public.workspaces w
        WHERE w.owner_user_id = uid
        LIMIT 1;
      END IF;

      IF v_workspace_id IS NULL THEN
        v_workspace_id := uid;
      END IF;

      SELECT s.status, s.current_period_end
      INTO v_status, v_period_end
      FROM public.subscriptions s
      WHERE s.workspace_id = v_workspace_id
      ORDER BY s.updated_at DESC
      LIMIT 1;

      IF v_status = 'active' THEN
        v_active := true;
      ELSIF v_status = 'trialing' AND v_period_end IS NOT NULL AND v_period_end > now() THEN
        v_active := true;
      END IF;
    END IF;

    result := result || jsonb_build_object(uid::text, v_active);
  END LOOP;

  RETURN result;
END;
$$;

-- =============================================
-- 5. get_campaign_members_with_emails (sharing modal "Has Access")
-- =============================================
CREATE OR REPLACE FUNCTION public.get_campaign_members_with_emails(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', cm.user_id,
        'email', au.email,
        'full_name', p.full_name,
        'role', cm.role
      )
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.campaign_members cm
  JOIN auth.users au ON au.id = cm.user_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.campaign_id = p_campaign_id
  ORDER BY cm.created_at DESC;

  RETURN result;
END;
$$;

-- =============================================
-- 6. add_campaign_member_by_email
-- =============================================
CREATE OR REPLACE FUNCTION public.add_campaign_member_by_email(
  p_campaign_id uuid,
  p_email text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
  v_sub_status jsonb;
  caller_uid uuid := auth.uid();
  p_role_normalized text := lower(trim(nullif(p_role, '')));
BEGIN
  IF p_campaign_id IS NULL OR trim(coalesce(p_email, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing campaign or email.');
  END IF;

  IF p_role_normalized NOT IN ('editor', 'viewer') THEN
    p_role_normalized := 'editor';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user found with this email.');
  END IF;

  SELECT user_id INTO v_owner_id
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found.');
  END IF;

  IF v_owner_id != caller_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the campaign owner can add members by email.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already has access to this campaign.');
  END IF;

  v_sub_status := public.check_users_subscription_status(ARRAY[v_user_id]);
  IF (v_sub_status->>(v_user_id::text)) IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only subscribed users can be added. Ask them to subscribe first.');
  END IF;

  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (p_campaign_id, v_user_id, p_role_normalized::text);

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- =============================================
-- 7. get_campaign_ids_shared_with_user
-- =============================================
CREATE OR REPLACE FUNCTION public.get_campaign_ids_shared_with_user()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(array_agg(campaign_id), '{}'::uuid[])
  FROM public.campaign_members
  WHERE user_id = auth.uid();
$$;

-- =============================================
-- 8. get_shared_campaigns_for_user (with posts stats for dashboard)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_shared_campaigns_for_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(campaign_row ORDER BY (campaign_row->>'created_at') DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'brand_name', c.brand_name,
      'status', c.status,
      'cover_image_url', c.cover_image_url,
      'start_date', c.start_date,
      'end_date', c.end_date,
      'created_at', c.created_at,
      'posts', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'views', p.views,
          'likes', p.likes,
          'comments', p.comments,
          'shares', p.shares,
          'engagement_rate', p.engagement_rate
        ))
        FROM public.posts p WHERE p.campaign_id = c.id
      ), '[]'::jsonb),
      'subcampaigns', jsonb_build_array(
        jsonb_build_object('count', (
          SELECT count(*) FROM public.campaigns sc
          WHERE sc.parent_campaign_id = c.id
        ))
      )
    ) AS campaign_row
    FROM public.campaigns c
    INNER JOIN public.campaign_members cm ON cm.campaign_id = c.id
    WHERE cm.user_id = auth.uid()
      AND c.parent_campaign_id IS NULL
  ) sub;

  RETURN result;
END;
$$;

-- =============================================
-- 9. get_campaign_by_id_for_member (campaign detail page)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_campaign_by_id_for_member(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
  caller_uid uuid := auth.uid();
BEGIN
  IF p_campaign_id IS NULL OR caller_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND (
        c.user_id = caller_uid
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = caller_uid
        )
      )
  ) THEN
    RETURN NULL;
  END IF;

  SELECT row_to_json(c.*)::jsonb INTO result
  FROM public.campaigns c
  WHERE c.id = p_campaign_id;

  RETURN result;
END;
$$;
