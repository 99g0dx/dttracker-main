-- 016_create_account_events.sql
-- Purpose: Minimal account activity log ("who did what").

CREATE TABLE IF NOT EXISTS public.account_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_events_workspace_id ON public.account_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_account_events_actor_id ON public.account_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_account_events_created_at ON public.account_events(created_at);

ALTER TABLE public.account_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account owner can view events"
  ON public.account_events
  FOR SELECT
  TO authenticated
  USING (workspace_id = auth.uid());

CREATE POLICY "Actors can view their own events"
  ON public.account_events
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "Members can insert events"
  ON public.account_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      workspace_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.workspace_id = account_events.workspace_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'active'
      )
    )
  );
