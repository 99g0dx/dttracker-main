-- Migration: Add subscription + seat-based billing v2
-- Description: Introduces plan_catalog, workspaces, workspace_members, subscriptions, usage counters,
--              Paystack webhook idempotency, and enforcement RPCs.

-- ============================================================
-- PLAN CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL CHECK (tier IN ('free', 'starter', 'pro', 'agency')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  base_price_cents INTEGER NOT NULL,
  included_seats INTEGER NOT NULL,
  extra_seat_price_cents INTEGER,
  max_active_campaigns INTEGER,
  max_creators_per_campaign INTEGER,
  platforms TEXT[] NOT NULL,
  scrape_interval_minutes INTEGER NOT NULL,
  retention_days INTEGER NOT NULL,
  api_access BOOLEAN DEFAULT false,
  white_label BOOLEAN DEFAULT false,
  paystack_base_plan_code TEXT,
  paystack_seat_plan_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tier, billing_cycle)
);

ALTER TABLE public.plan_catalog
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS base_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS included_seats INTEGER,
  ADD COLUMN IF NOT EXISTS extra_seat_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS max_active_campaigns INTEGER,
  ADD COLUMN IF NOT EXISTS max_creators_per_campaign INTEGER,
  ADD COLUMN IF NOT EXISTS platforms TEXT[],
  ADD COLUMN IF NOT EXISTS scrape_interval_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS retention_days INTEGER,
  ADD COLUMN IF NOT EXISTS api_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS white_label BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paystack_base_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_seat_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plan_catalog_tier_billing_cycle_key'
      AND conrelid = 'public.plan_catalog'::regclass
  ) THEN
    ALTER TABLE public.plan_catalog
      ADD CONSTRAINT plan_catalog_tier_billing_cycle_key UNIQUE (tier, billing_cycle);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_catalog_active ON public.plan_catalog(is_active) WHERE is_active = true;

-- Seed plan catalog (locked pricing + limits)
INSERT INTO public.plan_catalog (
  slug,
  name,
  tier,
  billing_cycle,
  base_price_cents,
  included_seats,
  extra_seat_price_cents,
  max_active_campaigns,
  max_creators_per_campaign,
  platforms,
  scrape_interval_minutes,
  retention_days,
  api_access,
  white_label,
  paystack_base_plan_code,
  paystack_seat_plan_code
) VALUES
(
  'free_monthly',
  'Free',
  'free',
  'monthly',
  0,
  1,
  NULL,
  1,
  10,
  ARRAY['tiktok'],
  2880,
  30,
  false,
  false,
  NULL,
  NULL
),
(
  'starter_monthly',
  'Starter',
  'starter',
  'monthly',
  1900,
  1,
  500,
  3,
  25,
  ARRAY['tiktok', 'instagram'],
  720,
  180,
  false,
  false,
  'starter_monthly',
  'starter_seat_monthly'
),
(
  'starter_yearly',
  'Starter',
  'starter',
  'yearly',
  18200,
  1,
  4800,
  3,
  25,
  ARRAY['tiktok', 'instagram'],
  720,
  180,
  false,
  false,
  'starter_yearly',
  'starter_seat_yearly'
),
(
  'pro_monthly',
  'Pro',
  'pro',
  'monthly',
  4900,
  2,
  900,
  10,
  100,
  ARRAY['tiktok', 'instagram', 'youtube', 'x', 'facebook'],
  240,
  36500,
  false,
  false,
  'pro_monthly',
  'pro_seat_monthly'
),
(
  'pro_yearly',
  'Pro',
  'pro',
  'yearly',
  47000,
  2,
  8600,
  10,
  100,
  ARRAY['tiktok', 'instagram', 'youtube', 'x', 'facebook'],
  240,
  36500,
  false,
  false,
  'pro_yearly',
  'pro_seat_yearly'
),
(
  'agency_monthly',
  'Agency',
  'agency',
  'monthly',
  12900,
  3,
  700,
  NULL,
  NULL,
  ARRAY['tiktok', 'instagram', 'youtube', 'x', 'facebook'],
  30,
  36500,
  true,
  true,
  'agency_monthly',
  'agency_seat_monthly'
),
(
  'agency_yearly',
  'Agency',
  'agency',
  'yearly',
  123800,
  3,
  6700,
  NULL,
  NULL,
  ARRAY['tiktok', 'instagram', 'youtube', 'x', 'facebook'],
  30,
  36500,
  true,
  true,
  'agency_yearly',
  'agency_seat_yearly'
)                                                                                                                                                                                                                                          
ON CONFLICT (tier, billing_cycle) DO UPDATE SET                                                                                                                                                                                            
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  base_price_cents = EXCLUDED.base_price_cents,                                                                                                                                                                                            
  included_seats = EXCLUDED.included_seats,                                                                                                                                                                                                
  extra_seat_price_cents = EXCLUDED.extra_seat_price_cents,                                                                                                                                                                                
  max_active_campaigns = EXCLUDED.max_active_campaigns,
  max_creators_per_campaign = EXCLUDED.max_creators_per_campaign,
  platforms = EXCLUDED.platforms,
  scrape_interval_minutes = EXCLUDED.scrape_interval_minutes,
  retention_days = EXCLUDED.retention_days,
  api_access = EXCLUDED.api_access,
  white_label = EXCLUDED.white_label,
  paystack_base_plan_code = EXCLUDED.paystack_base_plan_code,
  paystack_seat_plan_code = EXCLUDED.paystack_seat_plan_code,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active plan catalog" ON public.plan_catalog;
CREATE POLICY "Anyone can view active plan catalog"
  ON public.plan_catalog FOR SELECT
  USING (is_active = true);

-- ============================================================
-- WORKSPACES + MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('brand_owner', 'brand_member', 'agency_admin', 'agency_ops')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = target_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = target_workspace_id
      AND w.owner_user_id = target_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = target_user_id
      AND wm.role IN ('brand_owner', 'agency_admin', 'owner', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_workspace_member_role(input_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_constraint TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO role_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'workspace_members'
    AND c.conname = 'workspace_members_role_check';

  IF role_constraint LIKE '%brand_owner%' THEN
    RETURN CASE
      WHEN input_role = 'owner' THEN 'brand_owner'
      WHEN input_role = 'admin' THEN 'agency_admin'
      WHEN input_role = 'viewer' THEN 'agency_ops'
      ELSE 'brand_member'
    END;
  END IF;

  RETURN CASE
    WHEN input_role IN ('owner', 'admin', 'viewer') THEN input_role
    ELSE 'viewer'
  END;
END;
$$;

DROP POLICY IF EXISTS "Workspace members can view workspaces" ON public.workspaces;
CREATE POLICY "Workspace members can view workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));

DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Workspace admins can update workspaces" ON public.workspaces;
CREATE POLICY "Workspace admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.is_workspace_admin(id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can view workspace members" ON public.workspace_members;
CREATE POLICY "Workspace members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace admins can manage workspace members" ON public.workspace_members;
CREATE POLICY "Workspace admins can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- ============================================================
-- SUBSCRIPTIONS + USAGE COUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'starter', 'pro', 'agency')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  base_plan_code TEXT,
  seat_plan_code TEXT,
  paystack_customer_code TEXT,
  paystack_authorization_code TEXT,
  paystack_base_subscription_code TEXT,
  paystack_base_email_token TEXT,
  paystack_seat_subscription_code TEXT,
  paystack_seat_email_token TEXT,
  included_seats INTEGER NOT NULL DEFAULT 1,
  extra_seats INTEGER NOT NULL DEFAULT 0,
  total_seats INTEGER NOT NULL DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON public.subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_workspace
  ON public.subscriptions(workspace_id)
  WHERE status IN ('active', 'trialing', 'past_due', 'incomplete');

CREATE TABLE IF NOT EXISTS public.usage_counters (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  active_campaigns_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view subscriptions" ON public.subscriptions;
CREATE POLICY "Workspace members can view subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can view usage counters" ON public.usage_counters;
CREATE POLICY "Workspace members can view usage counters"
  ON public.usage_counters FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- ============================================================
-- PAYSTACK EVENTS (IDEMPOTENCY)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.paystack_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  reference TEXT,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.paystack_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAMPAIGN SCRAPE TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_platform_scrapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'x', 'facebook', 'twitter')),
  last_scraped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, platform)
);

ALTER TABLE public.campaign_platform_scrapes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_plan_catalog_updated_at'
  ) THEN
    CREATE TRIGGER set_plan_catalog_updated_at
    BEFORE UPDATE ON public.plan_catalog
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_workspaces_updated_at'
  ) THEN
    CREATE TRIGGER set_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_usage_counters_updated_at'
  ) THEN
    CREATE TRIGGER set_usage_counters_updated_at
    BEFORE UPDATE ON public.usage_counters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_campaign_platform_scrapes_updated_at'
  ) THEN
    CREATE TRIGGER set_campaign_platform_scrapes_updated_at
    BEFORE UPDATE ON public.campaign_platform_scrapes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- ============================================================
-- BACKFILL WORKSPACES + MEMBERS FROM EXISTING TEAM MEMBERS
-- ============================================================
INSERT INTO public.workspaces (id, name, owner_user_id)
SELECT DISTINCT tm.workspace_id, 'Workspace', tm.workspace_id
FROM public.team_members tm
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT tm.workspace_id,
       tm.user_id,
       public.resolve_workspace_member_role(tm.role) AS role
FROM public.team_members tm
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.usage_counters (workspace_id)
SELECT w.id
FROM public.workspaces w
ON CONFLICT (workspace_id) DO NOTHING;

UPDATE public.usage_counters uc
SET active_campaigns_count = counts.active_count,
    updated_at = now()
FROM (
  SELECT workspace_id, COUNT(*) AS active_count
  FROM public.campaigns
  WHERE status = 'active'
  GROUP BY workspace_id
) counts
WHERE uc.workspace_id = counts.workspace_id;

INSERT INTO public.subscriptions (
  workspace_id,
  tier,
  billing_cycle,
  status,
  included_seats,
  extra_seats,
  total_seats
)
SELECT w.id,
       'free',
       'monthly',
       'active',
       1,
       0,
       1
FROM public.workspaces w
ON CONFLICT DO NOTHING;

-- ============================================================
-- CAMPAIGN WORKSPACE COLUMN + USAGE COUNTER TRIGGERS
-- ============================================================
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID;
UPDATE public.campaigns SET workspace_id = user_id WHERE workspace_id IS NULL;
ALTER TABLE public.campaigns ALTER COLUMN workspace_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_usage_counter(target_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.usage_counters (workspace_id)
  VALUES (target_workspace_id)
  ON CONFLICT (workspace_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_active_campaigns_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_usage_counter(NEW.workspace_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.usage_counters
      SET active_campaigns_count = active_campaigns_count + 1,
          updated_at = now()
      WHERE workspace_id = NEW.workspace_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status THEN
      IF OLD.status = 'active' THEN
        UPDATE public.usage_counters
        SET active_campaigns_count = GREATEST(active_campaigns_count - 1, 0),
            updated_at = now()
        WHERE workspace_id = NEW.workspace_id;
      END IF;
      IF NEW.status = 'active' THEN
        UPDATE public.usage_counters
        SET active_campaigns_count = active_campaigns_count + 1,
            updated_at = now()
        WHERE workspace_id = NEW.workspace_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      UPDATE public.usage_counters
      SET active_campaigns_count = GREATEST(active_campaigns_count - 1, 0),
          updated_at = now()
      WHERE workspace_id = OLD.workspace_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_usage_counter_insert ON public.campaigns;
CREATE TRIGGER campaigns_usage_counter_insert
  AFTER INSERT ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_active_campaigns_counter();

DROP TRIGGER IF EXISTS campaigns_usage_counter_update ON public.campaigns;
CREATE TRIGGER campaigns_usage_counter_update
  AFTER UPDATE OF status ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_active_campaigns_counter();

DROP TRIGGER IF EXISTS campaigns_usage_counter_delete ON public.campaigns;
CREATE TRIGGER campaigns_usage_counter_delete
  AFTER DELETE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_active_campaigns_counter();

-- ============================================================
-- RPCs FOR ENFORCEMENT
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_plan(target_workspace_id UUID)
RETURNS public.plan_catalog
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record RECORD;
  plan_record public.plan_catalog;
BEGIN
  SELECT *
  INTO sub_record
  FROM public.subscriptions
  WHERE workspace_id = target_workspace_id
    AND status IN ('active', 'trialing', 'past_due', 'incomplete', 'canceled')
  ORDER BY updated_at DESC
  LIMIT 1;

  IF sub_record IS NULL THEN
    SELECT * INTO plan_record
    FROM public.plan_catalog
    WHERE tier = 'free' AND billing_cycle = 'monthly' AND is_active = true
    LIMIT 1;
    RETURN plan_record;
  END IF;

  -- If canceled but still within current period, honor paid tier
  IF sub_record.status = 'canceled' AND sub_record.current_period_end IS NOT NULL THEN
    IF sub_record.current_period_end < now() THEN
      SELECT * INTO plan_record
      FROM public.plan_catalog
      WHERE tier = 'free' AND billing_cycle = 'monthly' AND is_active = true
      LIMIT 1;
      RETURN plan_record;
    END IF;
  END IF;

  SELECT * INTO plan_record
  FROM public.plan_catalog
  WHERE tier = sub_record.tier
    AND billing_cycle = sub_record.billing_cycle
    AND is_active = true
  LIMIT 1;

  IF plan_record IS NULL THEN
    SELECT * INTO plan_record
    FROM public.plan_catalog
    WHERE tier = 'free' AND billing_cycle = 'monthly' AND is_active = true
    LIMIT 1;
  END IF;

  RETURN plan_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_subscription_blocked(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT *
  INTO sub_record
  FROM public.subscriptions
  WHERE workspace_id = target_workspace_id
    AND status IN ('active', 'trialing', 'past_due', 'incomplete', 'canceled')
  ORDER BY updated_at DESC
  LIMIT 1;

  IF sub_record IS NULL THEN
    RETURN false;
  END IF;

  IF sub_record.status IN ('past_due', 'incomplete') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
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

-- ============================================================
-- RLS UPDATES FOR ENFORCEMENT
-- ============================================================
-- Enforce campaign creation limits
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
CREATE POLICY "Users can insert their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.can_create_campaign(campaigns.workspace_id) AS c
      WHERE c.allowed = true
    )
  );

-- Enforce creator-per-campaign limits
DROP POLICY IF EXISTS "Users can insert campaign_creators for campaigns they own or edit" ON public.campaign_creators;
CREATE POLICY "Users can insert campaign_creators for campaigns they own or edit"
  ON public.campaign_creators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_creators.campaign_id
        AND (
          c.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'editor')
          )
        )
        AND EXISTS (
          SELECT 1 FROM public.can_add_creator(c.workspace_id, c.id) AS cc
          WHERE cc.allowed = true
        )
    )
  );

-- ============================================================
-- Sync legacy team_members into workspace_members for billing
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_workspace_member_from_team()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  mapped_role TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id
      AND user_id = OLD.user_id;
    RETURN OLD;
  END IF;

  mapped_role := public.resolve_workspace_member_role(NEW.role);

  INSERT INTO public.workspaces (id, name, owner_user_id)
  VALUES (NEW.workspace_id, 'Workspace', NEW.workspace_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.workspace_id, NEW.user_id, mapped_role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_sync_workspace_members ON public.team_members;
CREATE TRIGGER team_members_sync_workspace_members
  AFTER INSERT OR UPDATE OR DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workspace_member_from_team();

-- ============================================================
-- SEAT LIMIT ENFORCEMENT (legacy team_members insert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_workspace_seat_limit(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  seat_limit INTEGER;
  current_count INTEGER;
  sub_record RECORD;
BEGIN
  SELECT *
  INTO sub_record
  FROM public.subscriptions
  WHERE workspace_id = target_workspace_id
    AND status IN ('active', 'trialing', 'past_due', 'incomplete', 'canceled')
  ORDER BY updated_at DESC
  LIMIT 1;

  IF sub_record IS NULL THEN
    SELECT included_seats INTO seat_limit
    FROM public.plan_catalog
    WHERE tier = 'free' AND billing_cycle = 'monthly' AND is_active = true
    LIMIT 1;
  ELSE
    IF sub_record.status = 'canceled'
      AND sub_record.current_period_end IS NOT NULL
      AND sub_record.current_period_end < now() THEN
      SELECT included_seats INTO seat_limit
      FROM public.plan_catalog
      WHERE tier = 'free' AND billing_cycle = 'monthly' AND is_active = true
      LIMIT 1;
    ELSE
      seat_limit := sub_record.total_seats;
    END IF;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.team_members
  WHERE workspace_id = target_workspace_id
    AND status IN ('active', 'pending');

  RETURN current_count < seat_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_workspace_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.check_workspace_seat_limit(NEW.workspace_id) THEN
    RAISE EXCEPTION 'Seat limit reached for this workspace';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_seat_limit ON public.team_members;
CREATE TRIGGER team_members_seat_limit
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_seat_limit();

-- ============================================================
-- Defaults for new profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.workspaces (id, name, owner_user_id)
  VALUES (NEW.id, 'Workspace', NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'brand_owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO public.usage_counters (workspace_id)
  VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;

  INSERT INTO public.subscriptions (
    workspace_id,
    tier,
    billing_cycle,
    status,
    included_seats,
    extra_seats,
    total_seats
  )
  VALUES (NEW.id, 'free', 'monthly', 'active', 1, 0, 1)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_create_workspace ON public.profiles;
CREATE TRIGGER on_profile_created_create_workspace
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_workspace();
