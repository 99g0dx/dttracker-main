-- Migration: Wallet scope RPCs (5/6) - cancel_sm_panel_activation (refund remaining locked budget).

CREATE OR REPLACE FUNCTION public.cancel_sm_panel_activation(p_activation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_total_budget NUMERIC;
  v_spent_amount NUMERIC;
  v_remaining NUMERIC;
  v_new_balance NUMERIC;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT workspace_id, COALESCE(total_budget, 0), COALESCE(spent_amount, 0)
  INTO v_workspace_id, v_total_budget, v_spent_amount
  FROM public.activations
  WHERE id = p_activation_id AND type = 'sm_panel';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Activation not found or not SM panel';
  END IF;

  IF NOT (
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

  v_remaining := v_total_budget - v_spent_amount;

  IF v_remaining > 0 THEN
    UPDATE public.workspace_wallets
    SET
      locked_balance = locked_balance - v_remaining,
      balance = balance + v_remaining,
      updated_at = NOW()
    WHERE workspace_id = v_workspace_id
      AND locked_balance >= v_remaining;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient locked balance to refund';
    END IF;

    SELECT balance INTO v_new_balance
    FROM public.workspace_wallets
    WHERE workspace_id = v_workspace_id;

    INSERT INTO public.wallet_transactions (
      workspace_id, type, amount, balance_after,
      reference_type, reference_id, description
    ) VALUES (
      v_workspace_id, 'refund', v_remaining, v_new_balance,
      'activation', p_activation_id, 'SM panel cancelled – budget refunded'
    );
  END IF;

  UPDATE public.activations
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_activation_id;
END;
$$;
