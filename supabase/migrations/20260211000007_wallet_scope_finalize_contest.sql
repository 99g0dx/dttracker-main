-- Migration: Wallet scope RPCs (6/6) - finalize_contest_wallet (unlock prizes + refund remainder).
-- p_winner_payments: JSONB array of { "submission_id": uuid, "prize_amount": number }

CREATE OR REPLACE FUNCTION public.finalize_contest_wallet(
  p_activation_id UUID,
  p_winner_payments JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_total_budget NUMERIC;
  v_user_id UUID;
  w RECORD;
  v_prize NUMERIC;
  v_total_paid NUMERIC := 0;
  v_remaining NUMERIC;
  v_new_locked NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT workspace_id, COALESCE(total_budget, 0)
  INTO v_workspace_id, v_total_budget
  FROM public.activations
  WHERE id = p_activation_id AND type = 'contest';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Activation not found or not contest';
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

  FOR w IN SELECT * FROM jsonb_array_elements(p_winner_payments)
  LOOP
    v_prize := (w.value->>'prize_amount')::NUMERIC;
    IF v_prize IS NOT NULL AND v_prize > 0 THEN
      v_total_paid := v_total_paid + v_prize;

      UPDATE public.workspace_wallets
      SET
        locked_balance = locked_balance - v_prize,
        lifetime_spent = lifetime_spent + v_prize,
        updated_at = NOW()
      WHERE workspace_id = v_workspace_id
        AND locked_balance >= v_prize;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient locked balance for contest prize';
      END IF;

      SELECT locked_balance INTO v_new_locked
      FROM public.workspace_wallets
      WHERE workspace_id = v_workspace_id;

      INSERT INTO public.wallet_transactions (
        workspace_id, type, amount, balance_after,
        reference_type, reference_id, description
      ) VALUES (
        v_workspace_id, 'unlock', v_prize, v_new_locked,
        'contest_submission', (w.value->>'submission_id')::UUID,
        'Contest winner prize'
      );
    END IF;
  END LOOP;

  v_remaining := v_total_budget - v_total_paid;
  IF v_remaining > 0 THEN
    UPDATE public.workspace_wallets
    SET
      locked_balance = locked_balance - v_remaining,
      balance = balance + v_remaining,
      updated_at = NOW()
    WHERE workspace_id = v_workspace_id
      AND locked_balance >= v_remaining;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient locked balance to refund remainder';
    END IF;

    SELECT balance INTO v_new_balance
    FROM public.workspace_wallets
    WHERE workspace_id = v_workspace_id;

    INSERT INTO public.wallet_transactions (
      workspace_id, type, amount, balance_after,
      reference_type, reference_id, description
    ) VALUES (
      v_workspace_id, 'refund', v_remaining, v_new_balance,
      'activation', p_activation_id, 'Contest finalize – unused prize pool'
    );
  END IF;
END;
$$;
