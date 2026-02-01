-- Company admin: user management RPCs

CREATE OR REPLACE FUNCTION public.get_company_admin_users(
  search TEXT DEFAULT NULL,
  page_limit INT DEFAULT 50,
  page_offset INT DEFAULT 0
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
    w.id AS workspace_id,
    COALESCE(w.name, 'Workspace') AS workspace_name,
    pc.slug,
    s.status AS subscription_status,
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
    LOWER(u.email) LIKE '%' || LOWER(search) || '%' OR
    LOWER(COALESCE(p.full_name, '')) LIKE '%' || LOWER(search) || '%'
  )
  ORDER BY u.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_company_admin_users_count(
  search TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  total BIGINT;
BEGIN
  IF NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COUNT(*) INTO total
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE (
    search IS NULL OR search = '' OR
    LOWER(u.email) LIKE '%' || LOWER(search) || '%' OR
    LOWER(COALESCE(p.full_name, '')) LIKE '%' || LOWER(search) || '%'
  );

  RETURN total;
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
