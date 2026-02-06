-- Migration: Wallet scope RPCs (3/6) - join_sm_panel_atomic (tier-aware reservation, spent_amount only).

CREATE OR REPLACE FUNCTION public.join_sm_panel_atomic(
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
  v_activation_type TEXT;
  v_activation_status TEXT;
  v_current_spent NUMERIC;
  v_total_budget NUMERIC;
  v_locked_balance NUMERIC;
BEGIN
  IF p_payment_amount IS NULL OR p_payment_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT a.id, a.workspace_id, a.type, a.status,
         COALESCE(a.spent_amount, 0), COALESCE(a.total_budget, 0)
  INTO v_activation_id, v_workspace_id, v_activation_type, v_activation_status,
       v_current_spent, v_total_budget
  FROM public.activation_submissions s
  JOIN public.activations a ON a.id = s.activation_id
  WHERE s.id = p_submission_id;

  IF v_activation_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_activation_type <> 'sm_panel' THEN
    RAISE EXCEPTION 'Activation is not an SM panel';
  END IF;

  IF v_activation_status <> 'live' THEN
    RAISE EXCEPTION 'Activation is not live';
  END IF;

  -- When called with auth (app), no extra check; when called by service role (webhook), auth.uid() is NULL
  -- so we allow the reservation without user check (webhook is trusted).

  SELECT COALESCE(locked_balance, 0) INTO v_locked_balance
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  IF v_locked_balance IS NULL OR (v_current_spent + p_payment_amount) > v_locked_balance THEN
    RAISE EXCEPTION 'Insufficient locked balance for this reservation';
  END IF;

  UPDATE public.activations
  SET spent_amount = COALESCE(spent_amount, 0) + p_payment_amount,
      updated_at = NOW()
  WHERE id = v_activation_id;
END;
$$;
