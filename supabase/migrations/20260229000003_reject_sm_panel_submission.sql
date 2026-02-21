-- Adds reject_sm_panel_submission RPC.
-- Atomically marks a submission as rejected and refunds the reserved payment
-- amount back from locked_balance to available balance in workspace_wallets.
-- Also decrements activations.spent_amount to reflect the cancellation.

CREATE OR REPLACE FUNCTION public.reject_sm_panel_submission(
  p_submission_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activation_id UUID;
  v_workspace_id UUID;
  v_payment_amount NUMERIC;
  v_paid_at TIMESTAMPTZ;
  v_new_balance NUMERIC;
  v_new_locked NUMERIC;
BEGIN
  -- Fetch submission details
  SELECT s.activation_id, a.workspace_id, COALESCE(s.payment_amount, 0), s.paid_at
  INTO v_activation_id, v_workspace_id, v_payment_amount, v_paid_at
  FROM public.activation_submissions s
  JOIN public.activations a ON a.id = s.activation_id
  WHERE s.id = p_submission_id;

  IF v_activation_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found: %', p_submission_id;
  END IF;

  -- Guard: do not double-process an already-paid submission
  IF v_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Submission % has already been paid and cannot be rejected', p_submission_id;
  END IF;

  -- Mark the submission as rejected
  UPDATE public.activation_submissions
  SET
    status = 'rejected',
    reviewed_at = NOW()
  WHERE id = p_submission_id;

  -- Only adjust wallet if there was a reserved amount
  IF v_payment_amount > 0 THEN
    -- Decrement activations.spent_amount
    UPDATE public.activations
    SET
      spent_amount = GREATEST(0, COALESCE(spent_amount, 0) - v_payment_amount),
      updated_at = NOW()
    WHERE id = v_activation_id;

    -- Move reserved funds back from locked_balance to available balance
    UPDATE public.workspace_wallets
    SET
      locked_balance = GREATEST(0, locked_balance - v_payment_amount),
      balance = balance + v_payment_amount,
      updated_at = NOW()
    WHERE workspace_id = v_workspace_id
      AND locked_balance >= v_payment_amount;

    IF NOT FOUND THEN
      -- locked_balance insufficient — still complete the rejection but log a warning.
      -- This can happen if funds were already manually reconciled.
      RAISE WARNING 'reject_sm_panel_submission: locked_balance insufficient for workspace %, submission %. Rejection recorded without wallet adjustment.', v_workspace_id, p_submission_id;
    ELSE
      -- Record a refund transaction
      SELECT balance, locked_balance INTO v_new_balance, v_new_locked
      FROM public.workspace_wallets
      WHERE workspace_id = v_workspace_id;

      INSERT INTO public.wallet_transactions (
        workspace_id,
        type,
        amount,
        balance_after,
        locked_balance_after,
        reference_type,
        reference_id,
        description,
        status,
        processed_at
      ) VALUES (
        v_workspace_id,
        'refund',
        v_payment_amount,
        v_new_balance,
        v_new_locked,
        'activation_submission',
        p_submission_id,
        'SM panel submission rejected — reserved funds returned',
        'completed',
        NOW()
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_sm_panel_submission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_sm_panel_submission(UUID) TO service_role;
