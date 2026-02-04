-- Company admin by email: allow specific emails to always have company admin access
-- (e.g. when org_members/organizations are not set up or IP allowlist blocks them)

CREATE TABLE IF NOT EXISTS public.company_admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_admin_emails ENABLE ROW LEVEL SECURITY;

-- Only existing company admins can manage the list (org-based or email-based)
DROP POLICY IF EXISTS company_admin_emails_select ON public.company_admin_emails;
CREATE POLICY company_admin_emails_select
  ON public.company_admin_emails FOR SELECT
  USING (public.is_company_admin());

DROP POLICY IF EXISTS company_admin_emails_manage ON public.company_admin_emails;
CREATE POLICY company_admin_emails_manage
  ON public.company_admin_emails FOR ALL
  USING (public.is_company_admin())
  WITH CHECK (public.is_company_admin());

-- Seed known company admin email (runs with definer rights so it succeeds before is_company_admin is updated)
CREATE OR REPLACE FUNCTION public._seed_company_admin_email()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.company_admin_emails (email)
  VALUES ('solomonidrissu@gmail.com')
  ON CONFLICT (email) DO NOTHING;
$$;
SELECT public._seed_company_admin_email();
DROP FUNCTION public._seed_company_admin_email();

-- Update is_company_admin to grant access if current user's email is in the list
-- (checked after ban, but before IP allowlist so email-based admins are not locked out by IP)
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

  -- Email-based company admins always have access (bypasses IP allowlist and org membership)
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.company_admin_emails cae ON cae.email = u.email
    WHERE u.id = auth.uid()
  ) THEN
    RETURN true;
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
