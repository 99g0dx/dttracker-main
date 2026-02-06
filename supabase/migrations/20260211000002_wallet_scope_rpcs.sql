-- Migration: Wallet scope RPCs (1/6) - release_sm_panel_payment
-- Replaces unlock_activation_payment. Deducts locked_balance, increments lifetime_spent, inserts unlock tx.

CREATE OR REPLACE FUNCTION public.release_sm_panel_payment(
  p_submission_id UUID,
  p_payment_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activation_id UUID;
  v_workspace_id UUID;
  v_user_id UUID;
  v_new_locked NUMERIC;
BEGIN
  v_user_id := auth.uid();

  SELECT a.id, a.workspace_id INTO v_activation_id, v_workspace_id
  FROM public.activation_submissions s
  JOIN public.activations a ON a.id = s.activation_id
  WHERE s.id = p_submission_id;

  IF v_activation_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- When called with auth (app), enforce workspace access; when auth.uid() is NULL (e.g. service role / webhook), allow
  IF v_user_id IS NOT NULL AND NOT (
    v_workspace_id = v_user_id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = v_workspace_id
        AND wm.user_id = v_user_id
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
    )
  ) THEN
    RAISE EXCEPTION 'No access to this workspace';
  END IF;

  UPDATE public.workspace_wallets
  SET
    locked_balance = locked_balance - p_payment_amount,
    lifetime_spent = lifetime_spent + p_payment_amount,
    updated_at = NOW()
  WHERE workspace_id = v_workspace_id
    AND locked_balance >= p_payment_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient locked balance or wallet not found';
  END IF;

  SELECT locked_balance INTO v_new_locked
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  INSERT INTO public.wallet_transactions (
    workspace_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    metadata,
    description
  ) VALUES (
    v_workspace_id,
    'unlock',
    p_payment_amount,
    v_new_locked,
    'creator_activation',
    p_submission_id,
    jsonb_build_object('activation_id', v_activation_id, 'payment_amount', p_payment_amount),
    'SM panel payment released'
  );
END;
$$;
