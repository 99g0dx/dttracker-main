-- Adds cancel_contest_activation RPC.
-- Mirrors cancel_sm_panel_activation but operates on type = 'contest'.
-- Refunds the remaining unspent budget from locked_balance back to available balance.

CREATE OR REPLACE FUNCTION public.cancel_contest_activation(p_activation_id UUID)
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
  v_new_locked NUMERIC;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT workspace_id, COALESCE(total_budget, 0), COALESCE(spent_amount, 0)
  INTO v_workspace_id, v_total_budget, v_spent_amount
  FROM public.activations
  WHERE id = p_activation_id AND type = 'contest';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Activation not found or not a contest: %', p_activation_id;
  END IF;

  -- Verify the caller is a member of the workspace
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
    -- Return remaining locked budget to available balance
    UPDATE public.workspace_wallets
    SET
      locked_balance = locked_balance - v_remaining,
      balance = balance + v_remaining,
      updated_at = NOW()
    WHERE workspace_id = v_workspace_id
      AND locked_balance >= v_remaining;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient locked balance to refund contest budget for activation %', p_activation_id;
    END IF;

    SELECT balance, locked_balance INTO v_new_balance, v_new_locked
    FROM public.workspace_wallets
    WHERE workspace_id = v_workspace_id;

    INSERT INTO public.wallet_transactions (
      workspace_id, type, amount, balance_after, locked_balance_after,
      reference_type, reference_id, description, status, processed_at
    ) VALUES (
      v_workspace_id, 'refund', v_remaining, v_new_balance, v_new_locked,
      'activation', p_activation_id, 'Contest cancelled – budget refunded',
      'completed', NOW()
    );
  END IF;

  -- Mark the activation as cancelled
  UPDATE public.activations
  SET
    status = 'cancelled',
    cancelled_by = v_user_id,
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_activation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_contest_activation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_contest_activation(UUID) TO service_role;
