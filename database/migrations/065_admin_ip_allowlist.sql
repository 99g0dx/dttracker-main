-- Company admin IP allowlist enforcement

CREATE TABLE IF NOT EXISTS public.company_admin_ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  cidr cidr not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

ALTER TABLE public.company_admin_ip_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_admin_ip_allowlist_select ON public.company_admin_ip_allowlist;
CREATE POLICY company_admin_ip_allowlist_select
  ON public.company_admin_ip_allowlist FOR SELECT
  USING (public.is_company_admin());

DROP POLICY IF EXISTS company_admin_ip_allowlist_manage ON public.company_admin_ip_allowlist;
CREATE POLICY company_admin_ip_allowlist_manage
  ON public.company_admin_ip_allowlist FOR ALL
  USING (public.is_company_admin())
  WITH CHECK (public.is_company_admin());

-- Helper: resolve request IP
CREATE OR REPLACE FUNCTION public.get_request_ip()
RETURNS inet
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  xff text;
  xreal text;
  ip_text text;
BEGIN
  xff := current_setting('request.header.x-forwarded-for', true);
  xreal := current_setting('request.header.x-real-ip', true);

  IF xff IS NOT NULL AND xff <> '' THEN
    ip_text := split_part(xff, ',', 1);
  ELSIF xreal IS NOT NULL AND xreal <> '' THEN
    ip_text := xreal;
  ELSE
    ip_text := NULL;
  END IF;

  IF ip_text IS NULL OR ip_text = '' THEN
    RETURN NULL;
  END IF;

  RETURN ip_text::inet;
END;
$$;

-- Helper: check if request IP is allowed
CREATE OR REPLACE FUNCTION public.is_admin_ip_allowed()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_ip inet;
  has_rules boolean;
BEGIN
  req_ip := public.get_request_ip();

  SELECT EXISTS (
    SELECT 1 FROM public.company_admin_ip_allowlist
    WHERE is_active = true
  ) INTO has_rules;

  -- If no allowlist configured, allow by default
  IF NOT has_rules THEN
    RETURN true;
  END IF;

  IF req_ip IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.company_admin_ip_allowlist
    WHERE is_active = true
      AND req_ip <<= cidr
  );
END;
$$;

-- Update company admin helper to enforce IP allowlist
CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_user_banned(auth.uid()) THEN
    RETURN false;
  END IF;

  IF NOT public.is_admin_ip_allowed() THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND o.is_company_org = true
  );
END;
$$;
