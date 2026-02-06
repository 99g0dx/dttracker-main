-- Migration: Daily spend limit check and increment in release_sm_panel_payment and finalize_contest_wallet
-- Phase 2 of wallet improvements plan.

-- ============================================================
-- 1. release_sm_panel_payment - add daily limit check and increment
-- ============================================================
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
  v_balance_after NUMERIC;
  v_daily_limit NUMERIC;
  v_spent_today NUMERIC;
  v_reset_date DATE;
BEGIN
  v_user_id := auth.uid();

  SELECT a.id, a.workspace_id INTO v_activation_id, v_workspace_id
  FROM public.activation_submissions s
  JOIN public.activations a ON a.id = s.activation_id
  WHERE s.id = p_submission_id;

  IF v_activation_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

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

  SELECT daily_spend_limit, COALESCE(daily_spent_today, 0), last_spend_reset_date
  INTO v_daily_limit, v_spent_today, v_reset_date
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    v_spent_today := 0;
  END IF;

  IF v_daily_limit IS NOT NULL AND (v_spent_today + p_payment_amount) > v_daily_limit THEN
    RAISE EXCEPTION 'Daily spending limit exceeded. Limit: %, already spent today: %, requested: %',
      v_daily_limit, v_spent_today, p_payment_amount;
  END IF;

  UPDATE public.workspace_wallets
  SET
    locked_balance = locked_balance - p_payment_amount,
    lifetime_spent = lifetime_spent + p_payment_amount,
    daily_spent_today = CASE WHEN last_spend_reset_date IS NULL OR last_spend_reset_date < CURRENT_DATE THEN 0 ELSE COALESCE(daily_spent_today, 0) END + p_payment_amount,
    last_spend_reset_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE workspace_id = v_workspace_id
    AND locked_balance >= p_payment_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient locked balance or wallet not found';
  END IF;

  SELECT balance, locked_balance INTO v_balance_after, v_new_locked
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
    metadata,
    description,
    status,
    processed_at
  ) VALUES (
    v_workspace_id,
    'unlock',
    p_payment_amount,
    v_balance_after,
    v_new_locked,
    'creator_activation',
    p_submission_id,
    jsonb_build_object('activation_id', v_activation_id, 'payment_amount', p_payment_amount),
    'SM panel payment released',
    'completed',
    NOW()
  );
END;
$$;

-- ============================================================
-- 2. finalize_contest_wallet - add daily limit check and increment (per winner unlock and refund does not count as "spend" for limit; only unlock does)
-- ============================================================
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
  v_balance_after NUMERIC;
  v_new_locked NUMERIC;
  v_new_balance NUMERIC;
  v_daily_limit NUMERIC;
  v_spent_today NUMERIC;
  v_reset_date DATE;
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

  SELECT daily_spend_limit, COALESCE(daily_spent_today, 0), last_spend_reset_date
  INTO v_daily_limit, v_spent_today, v_reset_date
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    v_spent_today := 0;
  END IF;

  IF v_daily_limit IS NOT NULL AND (v_spent_today + v_total_budget) > v_daily_limit THEN
    RAISE EXCEPTION 'Daily spending limit exceeded. Limit: %, already spent today: %, contest total: %',
      v_daily_limit, v_spent_today, v_total_budget;
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
        daily_spent_today = CASE WHEN last_spend_reset_date IS NULL OR last_spend_reset_date < CURRENT_DATE THEN 0 ELSE COALESCE(daily_spent_today, 0) END + v_prize,
        last_spend_reset_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE workspace_id = v_workspace_id
        AND locked_balance >= v_prize;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient locked balance for contest prize';
      END IF;

      SELECT balance, locked_balance INTO v_balance_after, v_new_locked
      FROM public.workspace_wallets
      WHERE workspace_id = v_workspace_id;

      INSERT INTO public.wallet_transactions (
        workspace_id, type, amount, balance_after, locked_balance_after,
        reference_type, reference_id, description, status, processed_at
      ) VALUES (
        v_workspace_id, 'unlock', v_prize, v_balance_after, v_new_locked,
        'contest_submission', (w.value->>'submission_id')::UUID,
        'Contest winner prize',
        'completed', NOW()
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

    SELECT balance, locked_balance INTO v_new_balance, v_new_locked
    FROM public.workspace_wallets
    WHERE workspace_id = v_workspace_id;

    INSERT INTO public.wallet_transactions (
      workspace_id, type, amount, balance_after, locked_balance_after,
      reference_type, reference_id, description, status, processed_at
    ) VALUES (
      v_workspace_id, 'refund', v_remaining, v_new_balance, v_new_locked,
      'activation', p_activation_id, 'Contest finalize – unused prize pool',
      'completed', NOW()
    );
  END IF;
END;
$$;
