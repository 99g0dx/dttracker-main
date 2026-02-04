-- DB-level ban enforcement helpers (used by RLS)

CREATE OR REPLACE FUNCTION public.is_user_banned(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = target_user_id
      AND u.banned_until IS NOT NULL
      AND u.banned_until > now()
  );
$$;

-- Company admin helper (deny if banned)
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

-- Org membership helper (deny if banned)
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_user_banned(auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = target_org_id
      AND om.user_id = auth.uid()
  );
END;
$$;

-- Workspace membership helpers (deny if banned)
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_user_banned(target_user_id) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = target_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_user_banned(auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = auth.uid()
  );
END;
$$;

-- Workspace admin helpers (deny if banned)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_user_banned(target_user_id) THEN
    RETURN false;
  END IF;

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

-- Replace 1-arg is_workspace_admin in place (do not drop - RLS policies depend on it)
-- Parameter name must stay ws_id to match existing function signature
CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    NOT public.is_user_banned(auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = ws_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('brand_owner','agency_admin')
      )
      OR ws_id = auth.uid()
    );
$$;

-- Agency bypass helpers (deny if banned)
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
  ) AND NOT public.is_user_banned(target_user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_agency_privileges()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_user_banned(auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') IN ('agency', 'super_agency');
END;
$$;
