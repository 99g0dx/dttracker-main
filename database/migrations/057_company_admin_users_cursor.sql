-- Admin users cursor pagination + stats + audit logs

CREATE TABLE IF NOT EXISTS public.company_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

ALTER TABLE public.company_admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_admin_audit_logs_select ON public.company_admin_audit_logs;
CREATE POLICY company_admin_audit_logs_select
  ON public.company_admin_audit_logs FOR SELECT
  USING (public.is_company_admin());

CREATE OR REPLACE FUNCTION public.log_company_admin_action(
  target_user_id uuid,
  action text,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  xff text;
  xreal text;
  ip_text text;
  ua text;
BEGIN
  xff := current_setting('request.header.x-forwarded-for', true);
  xreal := current_setting('request.header.x-real-ip', true);
  ua := current_setting('request.header.user-agent', true);

  IF xff IS NOT NULL AND xff <> '' THEN
    ip_text := split_part(xff, ',', 1);
  ELSIF xreal IS NOT NULL AND xreal <> '' THEN
    ip_text := xreal;
  ELSE
    ip_text := NULL;
  END IF;

  INSERT INTO public.company_admin_audit_logs (actor_user_id, target_user_id, action, metadata)
  VALUES (
    auth.uid(),
    target_user_id,
    action,
    COALESCE(metadata, '{}'::jsonb) ||
      jsonb_build_object('ip', ip_text, 'user_agent', ua)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_company_admin_audit_logs_page(
  action_filter TEXT DEFAULT NULL,
  actor_filter TEXT DEFAULT NULL,
  date_filter TEXT DEFAULT '30d',
  page_limit INT DEFAULT 50,
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_log_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  actor_user_id UUID,
  target_user_id UUID,
  action TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.actor_user_id,
    l.target_user_id,
    l.action,
    l.metadata,
    l.created_at
  FROM public.company_admin_audit_logs l
  WHERE (
    action_filter IS NULL OR action_filter = '' OR l.action = action_filter
  )
  AND (
    date_filter IS NULL OR date_filter = 'all' OR
    (date_filter = '24h' AND l.created_at >= now() - interval '24 hours') OR
    (date_filter = '7d' AND l.created_at >= now() - interval '7 days') OR
    (date_filter = '30d' AND l.created_at >= now() - interval '30 days')
  )
  AND (
    actor_filter IS NULL OR actor_filter = '' OR
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id IN (l.actor_user_id, l.target_user_id)
        AND (
          LOWER(COALESCE(p.full_name::text, '')) LIKE '%' || LOWER(actor_filter) || '%'
          OR LOWER(COALESCE(p.email::text, '')) LIKE '%' || LOWER(actor_filter) || '%'
        )
    )
  )
  AND (
    cursor_created_at IS NULL OR cursor_log_id IS NULL OR
    (l.created_at, l.id) < (cursor_created_at, cursor_log_id)
  )
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT page_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_company_admin_users_page(
  search TEXT DEFAULT NULL,
  status_filter TEXT DEFAULT NULL,
  plan_filter TEXT DEFAULT NULL,
  page_limit INT DEFAULT 25,
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  is_banned BOOLEAN,
  require_password_change BOOLEAN,
  workspace_id UUID,
  workspace_name TEXT,
  plan_slug TEXT,
  subscription_status TEXT,
  billing_email TEXT,
  total_seats INT,
  trial_end_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    p.full_name::text,
    (u.raw_user_meta_data->>'phone')::text AS phone,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_banned,
    COALESCE(p.require_password_change, false) AS require_password_change,
    w.id AS workspace_id,
    COALESCE(w.name, 'Workspace')::text AS workspace_name,
    pc.slug::text,
    s.status::text AS subscription_status,
    NULL::text AS billing_email,
    s.total_seats,
    NULL::timestamptz AS trial_end_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.workspaces w ON w.owner_user_id = u.id
  LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
  LEFT JOIN public.plan_catalog pc
    ON pc.tier = s.tier AND pc.billing_cycle = s.billing_cycle AND pc.is_active = true
  WHERE (
    search IS NULL OR search = '' OR
    LOWER(u.email::text) LIKE '%' || LOWER(search) || '%' OR
    LOWER(COALESCE(p.full_name::text, '')) LIKE '%' || LOWER(search) || '%'
  )
  AND (
    status_filter IS NULL OR status_filter = '' OR
    (status_filter = 'banned' AND u.banned_until IS NOT NULL AND u.banned_until > now()) OR
    (status_filter = 'active' AND (u.banned_until IS NULL OR u.banned_until <= now())) OR
    (status_filter = 'expired' AND s.status = 'trialing' AND s.current_period_end IS NOT NULL AND s.current_period_end < now())
  )
  AND (
    plan_filter IS NULL OR plan_filter = '' OR s.tier::text = plan_filter
  )
  AND (
    cursor_created_at IS NULL OR cursor_user_id IS NULL OR
    (u.created_at, u.id) < (cursor_created_at, cursor_user_id)
  )
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT page_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_company_admin_user_stats(
  target_user_id UUID
)
RETURNS TABLE (
  total_campaigns INT,
  total_requests INT,
  total_creators INT,
  total_posts INT,
  total_views BIGINT
) AS $$
DECLARE
  ws_id UUID;
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id INTO ws_id
  FROM public.workspaces
  WHERE owner_user_id = target_user_id
  LIMIT 1;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.campaigns c WHERE c.workspace_id = ws_id)::int,
    (SELECT COUNT(*) FROM public.creator_requests r WHERE r.user_id = target_user_id)::int,
    (SELECT COUNT(*) FROM public.creators cr WHERE cr.user_id = target_user_id)::int,
    (SELECT COUNT(*) FROM public.posts p
       JOIN public.campaigns c ON c.id = p.campaign_id
       WHERE c.workspace_id = ws_id)::int,
    (SELECT COALESCE(SUM(p.views),0) FROM public.posts p
       JOIN public.campaigns c ON c.id = p.campaign_id
       WHERE c.workspace_id = ws_id)::bigint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.company_admin_set_ban(
  target_user_id UUID,
  ban_until TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE auth.users
  SET banned_until = ban_until
  WHERE id = target_user_id;

  PERFORM public.log_company_admin_action(target_user_id, 'set_ban', jsonb_build_object('ban_until', ban_until));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.company_admin_delete_user(
  target_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
  PERFORM public.log_company_admin_action(target_user_id, 'delete_user', '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.company_admin_set_user_subscription(
  target_user_id UUID,
  p_plan_slug TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_total_seats INT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  ws_id UUID;
  plan_record RECORD;
  effective_tier TEXT;
  effective_cycle TEXT;
  included_seats INT;
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id INTO ws_id
  FROM public.workspaces
  WHERE owner_user_id = target_user_id
  LIMIT 1;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'workspace not found for user %', target_user_id;
  END IF;

  IF p_plan_slug IS NOT NULL THEN
    SELECT tier, billing_cycle, included_seats
    INTO plan_record
    FROM public.plan_catalog
    WHERE slug = p_plan_slug
    LIMIT 1;
  END IF;

  effective_tier := COALESCE(plan_record.tier, NULL);
  effective_cycle := COALESCE(plan_record.billing_cycle, NULL);
  included_seats := COALESCE(plan_record.included_seats, 1);

  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE workspace_id = ws_id) THEN
    UPDATE public.subscriptions
    SET
      tier = COALESCE(effective_tier, public.subscriptions.tier),
      billing_cycle = COALESCE(effective_cycle, public.subscriptions.billing_cycle),
      status = COALESCE(p_status, public.subscriptions.status),
      total_seats = COALESCE(p_total_seats, public.subscriptions.total_seats),
      included_seats = COALESCE(included_seats, public.subscriptions.included_seats),
      updated_at = now()
    WHERE workspace_id = ws_id;
  ELSE
    INSERT INTO public.subscriptions (
      workspace_id,
      tier,
      billing_cycle,
      status,
      included_seats,
      extra_seats,
      total_seats
    )
    VALUES (
      ws_id,
      COALESCE(effective_tier, 'free'),
      COALESCE(effective_cycle, 'monthly'),
      COALESCE(p_status, 'active'),
      included_seats,
      0,
      COALESCE(p_total_seats, included_seats)
    );
  END IF;

  PERFORM public.log_company_admin_action(
    target_user_id,
    'set_subscription',
    jsonb_build_object('plan_slug', p_plan_slug, 'status', p_status, 'total_seats', p_total_seats)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
