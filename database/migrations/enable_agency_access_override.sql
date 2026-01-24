-- Migration: Enable full access for Agency and Super Agency roles
-- This adds RLS policies that bypass normal restrictions for users with specific roles

-- 1. Create helper function to check for agency roles
CREATE OR REPLACE FUNCTION public.has_agency_privileges()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the user has 'agency' or 'super_agency' role in their app_metadata
  -- This corresponds to the role set in auth.users.raw_app_meta_data
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') IN ('agency', 'super_agency');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply "Allow Everything" policies to key tables
-- RLS policies are additive (OR condition). If this policy passes, access is granted.
-- This effectively implements: IF agency THEN allow ELSE check other policies.

-- Table: workspaces
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workspaces') THEN
    DROP POLICY IF EXISTS "Agency full access on workspaces" ON public.workspaces;
    CREATE POLICY "Agency full access on workspaces" ON public.workspaces
      FOR ALL
      USING (public.has_agency_privileges());
  END IF;
END $$;

-- Table: creators
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'creators') THEN
    DROP POLICY IF EXISTS "Agency full access on creators" ON public.creators;
    CREATE POLICY "Agency full access on creators" ON public.creators
      FOR ALL
      USING (public.has_agency_privileges());
  END IF;
END $$;

-- Table: workspace_creators
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workspace_creators') THEN
    DROP POLICY IF EXISTS "Agency full access on workspace_creators" ON public.workspace_creators;
    CREATE POLICY "Agency full access on workspace_creators" ON public.workspace_creators
      FOR ALL
      USING (public.has_agency_privileges());
  END IF;
END $$;

-- Table: campaigns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    DROP POLICY IF EXISTS "Agency full access on campaigns" ON public.campaigns;
    CREATE POLICY "Agency full access on campaigns" ON public.campaigns
      FOR ALL
      USING (public.has_agency_privileges());
  END IF;
END $$;