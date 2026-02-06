-- Migration: withdrawal_requests - workspace payout to creator (minimal, no creator_wallets)
-- Phase 2 of wallet improvements plan.

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  activation_submission_id UUID REFERENCES public.activation_submissions(id) ON DELETE SET NULL,
  creator_id UUID,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  payment_reference TEXT,
  payment_provider TEXT,

  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_workspace ON public.withdrawal_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_requested ON public.withdrawal_requests(requested_at DESC);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY withdrawal_requests_workspace_admins_select
  ON public.withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = withdrawal_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
    )
  );

CREATE POLICY withdrawal_requests_workspace_admins_insert
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = withdrawal_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
    )
  );

CREATE POLICY withdrawal_requests_workspace_admins_update
  ON public.withdrawal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = withdrawal_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
    )
  );
