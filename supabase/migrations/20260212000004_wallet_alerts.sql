-- Migration: wallet_alerts - low balance and large spend alerts
-- Phase 2 of wallet improvements plan.

CREATE TABLE IF NOT EXISTS public.wallet_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_balance', 'large_spend')),
  threshold NUMERIC NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_alerts_workspace_type
  ON public.wallet_alerts(workspace_id, alert_type);

ALTER TABLE public.wallet_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_alerts_workspace_admins
  ON public.wallet_alerts FOR ALL
  USING (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = wallet_alerts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = wallet_alerts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );
