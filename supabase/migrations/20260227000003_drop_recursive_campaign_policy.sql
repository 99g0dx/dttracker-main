-- Fix: "infinite recursion detected in policy for relation campaigns"
-- The policy "Campaign members can view shared campaigns" on campaigns references
-- campaign_members, whose RLS policies reference campaigns, causing infinite recursion.
-- Drop it. Shared campaigns are fetched via SECURITY DEFINER RPC instead.

DROP POLICY IF EXISTS "Campaign members can view shared campaigns" ON public.campaigns;

-- Also drop the editor-shared update policy if it was created (same recursion issue)
DROP POLICY IF EXISTS "Users can update their own or editor-shared campaigns" ON public.campaigns;

-- Restore the original simple update policy if it was dropped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns'
      AND policyname = 'Users can update their own campaigns'
  ) THEN
    CREATE POLICY "Users can update their own campaigns"
      ON public.campaigns FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
