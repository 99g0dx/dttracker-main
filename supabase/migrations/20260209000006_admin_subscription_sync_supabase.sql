-- When admin sets a user's plan via Admin Users, sync to Supabase so enforcement sees it:
-- 1. profiles.agency_role: set to 'agency' when plan tier is agency, null otherwise (so has_agency_role() works).
-- 2. workspace_subscriptions: upsert so can_trigger_scrape and other enforcement that read workspace_subscriptions see the plan/status.
-- RPC convention: use v_ prefix for local variables to avoid ambiguous column references with table columns.

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
  v_status TEXT;
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
    
    IF plan_record IS NOT NULL THEN
      v_tier := plan_record.tier;
      v_cycle := plan_record.billing_cycle;
      v_included_seats := COALESCE(plan_record.included_seats, 1);
    END IF;
  END IF;
  
  v_status := COALESCE(p_status, 'active');

  -- Update public.subscriptions (admin-facing table)
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
      v_status,
      v_included_seats,
      0,
      COALESCE(p_total_seats, v_included_seats)
    );
  END IF;

  -- Sync to profiles.agency_role so has_agency_role() and agency bypasses recognize the account
  IF p_plan_slug IS NOT NULL THEN
    IF v_tier = 'agency' THEN
      UPDATE public.profiles
      SET agency_role = 'agency'
      WHERE id = target_user_id;
    ELSE
      UPDATE public.profiles
      SET agency_role = NULL
      WHERE id = target_user_id;
    END IF;
  END IF;

  -- Sync to workspace_subscriptions (plan_slug must exist in billing_plans: starter, pro, agency)
  IF p_plan_slug IS NOT NULL THEN
    INSERT INTO public.workspace_subscriptions (
      workspace_id,
      plan_slug,
      status,
      trial_end_at
    )
    VALUES (
      ws_id,
      CASE WHEN v_tier = 'agency' THEN 'agency' WHEN v_tier = 'pro' THEN 'pro' ELSE 'starter' END,
      v_status,
      CASE WHEN v_status = 'trialing' THEN now() + interval '14 days' ELSE NULL END
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      plan_slug = EXCLUDED.plan_slug,
      status = EXCLUDED.status,
      trial_end_at = CASE
        WHEN EXCLUDED.status = 'trialing' THEN COALESCE(public.workspace_subscriptions.trial_end_at, EXCLUDED.trial_end_at)
        ELSE NULL
      END;
  END IF;

  PERFORM public.log_company_admin_action(
    target_user_id,
    'set_subscription',
    jsonb_build_object('plan_slug', p_plan_slug, 'status', p_status, 'total_seats', p_total_seats)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

COMMENT ON FUNCTION public.company_admin_set_user_subscription(UUID, TEXT, TEXT, INT) IS
  'Admin: set user subscription. Also syncs profiles.agency_role and workspace_subscriptions so Supabase enforcement (scraping, limits) sees the change.';

-- One-time backfill: sync existing subscriptions (tier = agency) to profiles.agency_role and workspace_subscriptions
-- so accounts already set to agency in Admin (e.g. stressedkid64@gmail.com) are recognized in Supabase.
-- workspace_subscriptions.plan_slug FK references billing_plans(slug) which has 'starter', 'pro', 'agency' only.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT s.workspace_id, s.tier, s.status, w.owner_user_id
    FROM public.subscriptions s
    JOIN public.workspaces w ON w.id = s.workspace_id
    WHERE s.tier = 'agency'
  LOOP
    -- Set profiles.agency_role for owner (so has_agency_role() works)
    UPDATE public.profiles SET agency_role = 'agency' WHERE id = r.owner_user_id;
    -- Upsert workspace_subscriptions using billing_plans slug 'agency' (FK constraint)
    INSERT INTO public.workspace_subscriptions (workspace_id, plan_slug, status, trial_end_at)
    VALUES (r.workspace_id, 'agency', COALESCE(r.status, 'active'), NULL)
    ON CONFLICT (workspace_id) DO UPDATE SET
      plan_slug = 'agency',
      status = EXCLUDED.status;
  END LOOP;
END;
$$;
