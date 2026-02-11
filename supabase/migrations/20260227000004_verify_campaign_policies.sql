-- Diagnostic: ensure no campaign policy references campaign_members (causes recursion).
-- This migration is idempotent and only drops problematic policies.

-- Drop any policy on campaigns whose definition references campaign_members
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'campaigns'
      AND (qual::text LIKE '%campaign_members%' OR with_check::text LIKE '%campaign_members%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaigns', pol.policyname);
    RAISE NOTICE 'Dropped recursive policy: %', pol.policyname;
  END LOOP;
END
$$;

-- Ensure the basic owner-only policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' AND policyname='Users can view their own campaigns'
  ) THEN
    CREATE POLICY "Users can view their own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' AND policyname='Users can update their own campaigns'
  ) THEN
    CREATE POLICY "Users can update their own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' AND policyname='Users can insert their own campaigns'
  ) THEN
    CREATE POLICY "Users can insert their own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' AND policyname='Users can delete their own campaigns'
  ) THEN
    CREATE POLICY "Users can delete their own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;
