-- Add agency_role to profiles for internal/agency bypass
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_role TEXT CHECK (agency_role IN ('agency', 'super_agency'));

CREATE OR REPLACE FUNCTION public.has_agency_role(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = target_user_id
      AND p.agency_role IN ('agency', 'super_agency')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_campaign(target_workspace_id UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_record public.plan_catalog;
  active_count INTEGER;
BEGIN
  IF public.has_agency_role(auth.uid()) THEN
    RETURN QUERY SELECT true, 'ok';
    RETURN;
  END IF;

  IF public.is_subscription_blocked(target_workspace_id) THEN
    RETURN QUERY SELECT false, 'subscription_past_due';
    RETURN;
  END IF;

  plan_record := public.get_workspace_plan(target_workspace_id);
  SELECT active_campaigns_count INTO active_count
  FROM public.usage_counters
  WHERE workspace_id = target_workspace_id;

  active_count := COALESCE(active_count, 0);

  IF plan_record.max_active_campaigns IS NULL THEN
    RETURN QUERY SELECT true, 'ok';
    RETURN;
  END IF;

  IF active_count < plan_record.max_active_campaigns THEN
    RETURN QUERY SELECT true, 'ok';
  ELSE
    RETURN QUERY SELECT false, 'campaign_limit_reached';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_creator(target_workspace_id UUID, target_campaign_id UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_record public.plan_catalog;
  creator_count INTEGER;
BEGIN
  IF public.has_agency_role(auth.uid()) THEN
    RETURN QUERY SELECT true, 'ok';
    RETURN;
  END IF;

  IF public.is_subscription_blocked(target_workspace_id) THEN
    RETURN QUERY SELECT false, 'subscription_past_due';
    RETURN;
  END IF;

  plan_record := public.get_workspace_plan(target_workspace_id);

  SELECT COUNT(*) INTO creator_count
  FROM public.campaign_creators
  WHERE campaign_id = target_campaign_id;

  IF plan_record.max_creators_per_campaign IS NULL THEN
    RETURN QUERY SELECT true, 'ok';
    RETURN;
  END IF;

  IF creator_count < plan_record.max_creators_per_campaign THEN
    RETURN QUERY SELECT true, 'ok';
  ELSE
    RETURN QUERY SELECT false, 'creator_limit_reached';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_trigger_scrape(target_workspace_id UUID, target_campaign_id UUID, target_platform TEXT)
RETURNS TABLE(allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_record public.plan_catalog;
  last_scrape TIMESTAMPTZ;
  normalized_platform TEXT;
BEGIN
  IF public.has_agency_role(auth.uid()) THEN
    RETURN QUERY SELECT true, 'ok';
    RETURN;
  END IF;

  IF public.is_subscription_blocked(target_workspace_id) THEN
    RETURN QUERY SELECT false, 'subscription_past_due';
    RETURN;
  END IF;

  plan_record := public.get_workspace_plan(target_workspace_id);

  normalized_platform := CASE
    WHEN target_platform = 'twitter' THEN 'x'
    ELSE target_platform
  END;

  IF NOT (normalized_platform = ANY(plan_record.platforms)) THEN
    RETURN QUERY SELECT false, 'platform_not_allowed';
    RETURN;
  END IF;

  SELECT cps.last_scraped_at INTO last_scrape
  FROM public.campaign_platform_scrapes cps
  WHERE cps.campaign_id = target_campaign_id
    AND cps.platform = target_platform
  LIMIT 1;

  IF last_scrape IS NULL THEN
    RETURN QUERY SELECT true, 'ok';
    RETURN;
  END IF;

  IF (now() - last_scrape) >= make_interval(mins => plan_record.scrape_interval_minutes) THEN
    RETURN QUERY SELECT true, 'ok';
  ELSE
    RETURN QUERY SELECT false, 'scrape_interval_not_met';
  END IF;
END;
$$;
