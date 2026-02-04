-- Fix ambiguous column reference 'included_seats' in company_admin_set_user_subscription
-- (variable name collided with public.subscriptions.included_seats in UPDATE SET)

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
  v_tier TEXT;
  v_cycle TEXT;
  v_included_seats INT;
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

  v_tier := plan_record.tier;
  v_cycle := plan_record.billing_cycle;
  v_included_seats := COALESCE(plan_record.included_seats, 1);

  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE workspace_id = ws_id) THEN
    UPDATE public.subscriptions
    SET
      tier = COALESCE(v_tier, public.subscriptions.tier),
      billing_cycle = COALESCE(v_cycle, public.subscriptions.billing_cycle),
      status = COALESCE(p_status, public.subscriptions.status),
      total_seats = COALESCE(p_total_seats, public.subscriptions.total_seats),
      included_seats = COALESCE(v_included_seats, public.subscriptions.included_seats),
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
      COALESCE(v_tier, 'free'),
      COALESCE(v_cycle, 'monthly'),
      COALESCE(p_status, 'active'),
      v_included_seats,
      0,
      COALESCE(p_total_seats, v_included_seats)
    );
  END IF;

  PERFORM public.log_company_admin_action(
    target_user_id,
    'set_subscription',
    jsonb_build_object('plan_slug', p_plan_slug, 'status', p_status, 'total_seats', p_total_seats)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
