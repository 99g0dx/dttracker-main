-- Migration: wallet_reconciliations table and reconcile RPC
-- Phase 3 of wallet improvements plan.

CREATE TABLE IF NOT EXISTS public.wallet_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,

  expected_balance NUMERIC NOT NULL,
  actual_balance NUMERIC NOT NULL,
  discrepancy NUMERIC GENERATED ALWAYS AS (actual_balance - expected_balance) STORED,

  expected_locked NUMERIC NOT NULL DEFAULT 0,
  actual_locked NUMERIC NOT NULL DEFAULT 0,
  discrepancy_locked NUMERIC GENERATED ALWAYS AS (actual_locked - expected_locked) STORED,

  transaction_count INTEGER,
  total_funds NUMERIC,
  total_locks NUMERIC,
  total_unlocks NUMERIC,
  total_refunds NUMERIC,
  total_payouts NUMERIC,

  status TEXT NOT NULL DEFAULT 'reconciled' CHECK (status IN ('reconciled', 'discrepancy_found')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_reconciliations_workspace ON public.wallet_reconciliations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wallet_reconciliations_date ON public.wallet_reconciliations(reconciliation_date DESC);

ALTER TABLE public.wallet_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_reconciliations_workspace_admins
  ON public.wallet_reconciliations FOR ALL
  USING (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = wallet_reconciliations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = wallet_reconciliations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- RPC: reconcile workspace wallet (compute expected from transactions, compare to actual)
CREATE OR REPLACE FUNCTION public.reconcile_wallet(p_workspace_id UUID)
RETURNS public.wallet_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_expected_balance NUMERIC := 0;
  v_expected_locked NUMERIC := 0;
  v_actual_balance NUMERIC;
  v_actual_locked NUMERIC;
  v_tx_count INTEGER;
  v_total_funds NUMERIC := 0;
  v_total_locks NUMERIC := 0;
  v_total_unlocks NUMERIC := 0;
  v_total_refunds NUMERIC := 0;
  v_total_payouts NUMERIC := 0;
  v_status TEXT;
  v_row public.wallet_reconciliations;
  r RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    p_workspace_id = v_user_id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = v_user_id
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  ) THEN
    RAISE EXCEPTION 'No access to this workspace';
  END IF;

  FOR r IN
    SELECT type, amount
    FROM public.wallet_transactions
    WHERE workspace_id = p_workspace_id
      AND status = 'completed'
  LOOP
    v_tx_count := COALESCE(v_tx_count, 0) + 1;
    CASE r.type
      WHEN 'fund' THEN
        v_expected_balance := v_expected_balance + r.amount;
        v_total_funds := v_total_funds + r.amount;
      WHEN 'lock' THEN
        v_expected_balance := v_expected_balance - r.amount;
        v_expected_locked := v_expected_locked + r.amount;
        v_total_locks := v_total_locks + r.amount;
      WHEN 'unlock' THEN
        v_expected_locked := v_expected_locked - r.amount;
        v_total_unlocks := v_total_unlocks + r.amount;
      WHEN 'refund' THEN
        v_expected_balance := v_expected_balance + r.amount;
        v_expected_locked := v_expected_locked - r.amount;
        v_total_refunds := v_total_refunds + r.amount;
      WHEN 'payout' THEN
        v_expected_balance := v_expected_balance - r.amount;
        v_total_payouts := v_total_payouts + r.amount;
      ELSE
        NULL;
    END CASE;
  END LOOP;

  SELECT balance, locked_balance INTO v_actual_balance, v_actual_locked
  FROM public.workspace_wallets
  WHERE workspace_id = p_workspace_id;

  v_actual_balance := COALESCE(v_actual_balance, 0);
  v_actual_locked := COALESCE(v_actual_locked, 0);

  IF (v_actual_balance - v_expected_balance) != 0 OR (v_actual_locked - v_expected_locked) != 0 THEN
    v_status := 'discrepancy_found';
  ELSE
    v_status := 'reconciled';
  END IF;

  INSERT INTO public.wallet_reconciliations (
    workspace_id,
    reconciliation_date,
    expected_balance,
    actual_balance,
    expected_locked,
    actual_locked,
    transaction_count,
    total_funds,
    total_locks,
    total_unlocks,
    total_refunds,
    total_payouts,
    status,
    created_by
  ) VALUES (
    p_workspace_id,
    CURRENT_DATE,
    v_expected_balance,
    v_actual_balance,
    v_expected_locked,
    v_actual_locked,
    v_tx_count,
    v_total_funds,
    v_total_locks,
    v_total_unlocks,
    v_total_refunds,
    v_total_payouts,
    v_status,
    v_user_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
