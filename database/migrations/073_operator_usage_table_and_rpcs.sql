-- Per-operator usage limits: table + get_or_reset + record_export_and_check_limit.
-- Owner is not subject to operator caps; workspace plan limits still apply to everyone.

CREATE TABLE IF NOT EXISTS public.operator_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaigns_created_month INT NOT NULL DEFAULT 0,
  creators_added_month INT NOT NULL DEFAULT 0,
  scrapes_today INT NOT NULL DEFAULT 0,
  exports_today INT NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_operator_usage_workspace_id ON public.operator_usage(workspace_id);

ALTER TABLE public.operator_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operator_usage_select_own ON public.operator_usage;
CREATE POLICY operator_usage_select_own
  ON public.operator_usage FOR SELECT
  USING (user_id = auth.uid());

-- Only SECURITY DEFINER functions should INSERT/UPDATE (no policy for insert/update by user).
-- Service role or RPCs will update.

-- Get or reset operator usage row (resets daily/monthly as needed). Returns the row.
CREATE OR REPLACE FUNCTION public.get_or_reset_operator_usage(
  p_user_id UUID,
  p_workspace_id UUID
)
RETURNS public.operator_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_record public.operator_usage;
  now_ts TIMESTAMPTZ := now();
  need_daily_reset BOOLEAN;
  need_monthly_reset BOOLEAN;
BEGIN
  INSERT INTO public.operator_usage (user_id, workspace_id)
  VALUES (p_user_id, p_workspace_id)
  ON CONFLICT (user_id, workspace_id) DO NOTHING;

  SELECT * INTO row_record
  FROM public.operator_usage
  WHERE user_id = p_user_id AND workspace_id = p_workspace_id;

  need_daily_reset := date_trunc('day', row_record.last_reset_at) < date_trunc('day', now_ts);
  need_monthly_reset := date_trunc('month', row_record.last_reset_at) < date_trunc('month', now_ts);

  IF need_daily_reset OR need_monthly_reset THEN
    UPDATE public.operator_usage
    SET
      scrapes_today = CASE WHEN need_daily_reset THEN 0 ELSE scrapes_today END,
      exports_today = CASE WHEN need_daily_reset THEN 0 ELSE exports_today END,
      campaigns_created_month = CASE WHEN need_monthly_reset THEN 0 ELSE campaigns_created_month END,
      creators_added_month = CASE WHEN need_monthly_reset THEN 0 ELSE creators_added_month END,
      last_reset_at = now_ts
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;

    SELECT * INTO row_record
    FROM public.operator_usage
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;
  END IF;

  RETURN row_record;
END;
$$;

-- Per-operator limits by plan (PRO / AGENCY). Others get PRO limits.
CREATE OR REPLACE FUNCTION public.get_operator_limits(p_workspace_id UUID)
RETURNS TABLE(
  scrapes_today_limit INT,
  exports_today_limit INT,
  campaigns_created_month_limit INT,
  creators_added_month_limit INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT s.tier INTO v_tier
  FROM public.subscriptions s
  WHERE s.workspace_id = p_workspace_id
    AND s.status IN ('active', 'trialing', 'past_due', 'incomplete', 'canceled')
  ORDER BY s.updated_at DESC
  LIMIT 1;

  v_tier := COALESCE(v_tier, 'pro');

  IF v_tier = 'agency' THEN
    scrapes_today_limit := 25;
    exports_today_limit := 15;
    campaigns_created_month_limit := 10;
    creators_added_month_limit := 150;
  ELSE
    scrapes_today_limit := 10;
    exports_today_limit := 5;
    campaigns_created_month_limit := 3;
    creators_added_month_limit := 30;
  END IF;
  RETURN NEXT;
END;
$$;

-- Record export and check limit. Returns { allowed: boolean, reason?: text }.
CREATE OR REPLACE FUNCTION public.record_export_and_check_limit(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_usage public.operator_usage;
  v_limits RECORD;
BEGIN
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_usage := public.get_or_reset_operator_usage(v_user_id, p_workspace_id);
  SELECT * INTO v_limits FROM public.get_operator_limits(p_workspace_id) LIMIT 1;

  IF v_usage.exports_today >= v_limits.exports_today_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'export_limit_reached');
  END IF;

  UPDATE public.operator_usage
  SET exports_today = exports_today + 1
  WHERE user_id = v_user_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Check operator scrape limit (for Edge or frontend). p_user_id optional (Edge passes user from token).
CREATE OR REPLACE FUNCTION public.check_operator_scrape_limit(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT;
  v_usage public.operator_usage;
  v_limits RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_usage := public.get_or_reset_operator_usage(v_user_id, p_workspace_id);
  SELECT * INTO v_limits FROM public.get_operator_limits(p_workspace_id) LIMIT 1;

  IF v_usage.scrapes_today >= v_limits.scrapes_today_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'scrape_limit_reached');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Increment operator scrapes_today (call after successful scrape). p_user_id optional for Edge.
CREATE OR REPLACE FUNCTION public.increment_operator_scrapes_today(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN;
  END IF;

  PERFORM public.get_or_reset_operator_usage(v_user_id, p_workspace_id);

  UPDATE public.operator_usage
  SET scrapes_today = scrapes_today + 1
  WHERE user_id = v_user_id AND workspace_id = p_workspace_id;
END;
$$;
