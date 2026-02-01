-- Enforce per-operator limits on campaign create and workspace_creators (creator add).
-- Owner (brand_owner) is not subject to these limits.

CREATE OR REPLACE FUNCTION public.check_operator_campaign_create_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_usage public.operator_usage;
  v_limits RECORD;
BEGIN
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id AND wm.user_id = auth.uid()
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN NEW;
  END IF;

  v_usage := public.get_or_reset_operator_usage(auth.uid(), NEW.workspace_id);
  SELECT * INTO v_limits FROM public.get_operator_limits(NEW.workspace_id) LIMIT 1;

  IF v_usage.campaigns_created_month >= v_limits.campaigns_created_month_limit THEN
    RAISE EXCEPTION 'Campaign create limit reached for this month. Limit: %', v_limits.campaigns_created_month_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_operator_campaigns_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id AND wm.user_id = auth.uid()
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN NEW;
  END IF;

  PERFORM public.get_or_reset_operator_usage(auth.uid(), NEW.workspace_id);

  UPDATE public.operator_usage
  SET campaigns_created_month = campaigns_created_month + 1
  WHERE user_id = auth.uid() AND workspace_id = NEW.workspace_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_operator_campaign_create_limit_trigger ON public.campaigns;
CREATE TRIGGER check_operator_campaign_create_limit_trigger
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.check_operator_campaign_create_limit();

DROP TRIGGER IF EXISTS increment_operator_campaigns_created_trigger ON public.campaigns;
CREATE TRIGGER increment_operator_campaigns_created_trigger
  AFTER INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.increment_operator_campaigns_created();

CREATE OR REPLACE FUNCTION public.check_operator_creator_add_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_usage public.operator_usage;
  v_limits RECORD;
BEGIN
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id AND wm.user_id = auth.uid()
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN NEW;
  END IF;

  v_usage := public.get_or_reset_operator_usage(auth.uid(), NEW.workspace_id);
  SELECT * INTO v_limits FROM public.get_operator_limits(NEW.workspace_id) LIMIT 1;

  IF v_usage.creators_added_month >= v_limits.creators_added_month_limit THEN
    RAISE EXCEPTION 'Creator add limit reached for this month. Limit: %', v_limits.creators_added_month_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_operator_creators_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id AND wm.user_id = auth.uid()
  LIMIT 1;

  IF v_role = 'brand_owner' THEN
    RETURN NEW;
  END IF;

  PERFORM public.get_or_reset_operator_usage(auth.uid(), NEW.workspace_id);

  UPDATE public.operator_usage
  SET creators_added_month = creators_added_month + 1
  WHERE user_id = auth.uid() AND workspace_id = NEW.workspace_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_operator_creator_add_limit_trigger ON public.workspace_creators;
CREATE TRIGGER check_operator_creator_add_limit_trigger
  BEFORE INSERT ON public.workspace_creators
  FOR EACH ROW EXECUTE FUNCTION public.check_operator_creator_add_limit();

DROP TRIGGER IF EXISTS increment_operator_creators_added_trigger ON public.workspace_creators;
CREATE TRIGGER increment_operator_creators_added_trigger
  AFTER INSERT ON public.workspace_creators
  FOR EACH ROW EXECUTE FUNCTION public.increment_operator_creators_added();
