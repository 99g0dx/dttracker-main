-- Allow any authenticated user to see creators that are publicly published on Discover.
-- The existing "workspace members can view workspace creators" policy only lets users
-- see creators already in their own workspace, which breaks the Discover page for
-- Dobbletap-synced creators that are not yet in any user's workspace.
-- This additive (PERMISSIVE) policy makes active+live creators visible to everyone,
-- enabling the Discover marketplace to work correctly for all accounts.

DROP POLICY IF EXISTS "Live active creators visible on discover" ON public.creators;

CREATE POLICY "Live active creators visible on discover"
  ON public.creators FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'active'
    AND profile_status = 'live'
  );
