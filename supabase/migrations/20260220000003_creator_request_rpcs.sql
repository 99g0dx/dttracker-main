-- Migration: RPC functions for creator_request invitations
-- These handle the lock-on-accept flow and payment release

-- ============================================================
-- ACCEPT INVITATION (Creator)
-- Locks funds from workspace wallet when creator accepts
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_creator_request_invitation(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_activation RECORD;
  v_creator_id UUID;
  v_workspace_id UUID;
  v_quoted_rate NUMERIC;
  v_available_balance NUMERIC;
  v_new_balance NUMERIC;
  v_new_locked NUMERIC;
  v_tx_id UUID;
BEGIN
  -- Get the creator_id for the current user
  SELECT id INTO v_creator_id
  FROM public.creators
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Creator profile not found for current user';
  END IF;

  -- Fetch invitation and verify ownership
  SELECT * INTO v_invitation
  FROM public.creator_request_invitations
  WHERE id = p_invitation_id
    AND creator_id = v_creator_id
    AND status = 'pending';

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found, not yours, or already responded';
  END IF;

  v_quoted_rate := v_invitation.quoted_rate;

  -- Fetch activation and verify it's live
  SELECT * INTO v_activation
  FROM public.activations
  WHERE id = v_invitation.activation_id
    AND type = 'creator_request'
    AND status = 'live';

  IF v_activation IS NULL THEN
    RAISE EXCEPTION 'Activation not found or not active';
  END IF;

  v_workspace_id := v_activation.workspace_id;

  -- Check workspace wallet has sufficient balance
  SELECT balance INTO v_available_balance
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  IF v_available_balance IS NULL THEN
    RAISE EXCEPTION 'Workspace wallet not found';
  END IF;

  IF v_available_balance < v_quoted_rate THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, Required: %',
      v_available_balance, v_quoted_rate;
  END IF;

  -- Lock funds from workspace wallet (atomically)
  UPDATE public.workspace_wallets
  SET
    balance = balance - v_quoted_rate,
    locked_balance = locked_balance + v_quoted_rate,
    updated_at = NOW()
  WHERE workspace_id = v_workspace_id
    AND balance >= v_quoted_rate;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to lock funds (race condition or insufficient balance)';
  END IF;

  -- Get updated balances for transaction record
  SELECT balance, locked_balance INTO v_new_balance, v_new_locked
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  -- Insert wallet transaction record
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
    processed_at,
    metadata
  ) VALUES (
    v_workspace_id,
    'lock',
    v_quoted_rate,
    v_new_balance,
    v_new_locked,
    'creator_request_invitation',
    p_invitation_id,
    format('Funds locked for creator request: %s', v_activation.title),
    'completed',
    NOW(),
    jsonb_build_object(
      'activation_id', v_invitation.activation_id,
      'creator_id', v_creator_id,
      'quoted_rate', v_quoted_rate
    )
  )
  RETURNING id INTO v_tx_id;

  -- Update invitation status to accepted
  UPDATE public.creator_request_invitations
  SET
    status = 'accepted',
    wallet_locked = true,
    wallet_transaction_id = v_tx_id,
    responded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invitation_id;

  -- Update activation spent_amount to track committed funds
  UPDATE public.activations
  SET
    spent_amount = COALESCE(spent_amount, 0) + v_quoted_rate,
    updated_at = NOW()
  WHERE id = v_invitation.activation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', p_invitation_id,
    'locked_amount', v_quoted_rate,
    'activation_title', v_activation.title
  );
END;
$$;

COMMENT ON FUNCTION public.accept_creator_request_invitation IS 'Creator accepts invitation - locks quoted_rate from workspace wallet';

-- ============================================================
-- DECLINE INVITATION (Creator)
-- No wallet changes, just updates invitation status
-- ============================================================

CREATE OR REPLACE FUNCTION public.decline_creator_request_invitation(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  -- Get the creator_id for the current user
  SELECT id INTO v_creator_id
  FROM public.creators
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Creator profile not found for current user';
  END IF;

  -- Update invitation status
  UPDATE public.creator_request_invitations
  SET
    status = 'declined',
    responded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invitation_id
    AND creator_id = v_creator_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, not yours, or already responded';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', p_invitation_id
  );
END;
$$;

COMMENT ON FUNCTION public.decline_creator_request_invitation IS 'Creator declines invitation - no wallet changes';

-- ============================================================
-- RELEASE PAYMENT (Brand)
-- Called when brand approves the creator's deliverable
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_creator_request_payment(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_activation RECORD;
  v_workspace_id UUID;
  v_creator_id UUID;
  v_payment_amount NUMERIC;
  v_new_balance NUMERIC;
  v_new_locked NUMERIC;
  v_creator_balance NUMERIC;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Fetch invitation (must be accepted and locked)
  SELECT * INTO v_invitation
  FROM public.creator_request_invitations
  WHERE id = p_invitation_id
    AND status = 'accepted'
    AND wallet_locked = true;

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or not in accepted/locked state';
  END IF;

  -- Idempotency check - don't double-process
  IF v_invitation.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'payment_amount', v_invitation.quoted_rate
    );
  END IF;

  v_payment_amount := v_invitation.quoted_rate;
  v_creator_id := v_invitation.creator_id;

  -- Fetch activation and verify workspace access
  SELECT * INTO v_activation
  FROM public.activations
  WHERE id = v_invitation.activation_id;

  IF v_activation IS NULL THEN
    RAISE EXCEPTION 'Activation not found';
  END IF;

  v_workspace_id := v_activation.workspace_id;

  -- Verify caller has workspace access
  IF v_user_id IS NOT NULL AND NOT (
    v_workspace_id = v_user_id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = v_workspace_id
        AND wm.user_id = v_user_id
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
        AND wm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'No access to this workspace';
  END IF;

  -- Release from locked balance (deduct)
  UPDATE public.workspace_wallets
  SET
    locked_balance = locked_balance - v_payment_amount,
    lifetime_spent = lifetime_spent + v_payment_amount,
    daily_spent_today = daily_spent_today + v_payment_amount,
    updated_at = NOW()
  WHERE workspace_id = v_workspace_id
    AND locked_balance >= v_payment_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient locked balance to release payment';
  END IF;

  -- Get updated balances
  SELECT balance, locked_balance INTO v_new_balance, v_new_locked
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  -- Insert unlock transaction
  INSERT INTO public.wallet_transactions (
    workspace_id, type, amount, balance_after, locked_balance_after,
    reference_type, reference_id, description, status, processed_at, metadata
  ) VALUES (
    v_workspace_id, 'unlock', v_payment_amount,
    v_new_balance, v_new_locked,
    'creator_request_payment', p_invitation_id,
    format('Payment released for creator request: %s', v_activation.title),
    'completed', NOW(),
    jsonb_build_object('activation_id', v_activation.id, 'creator_id', v_creator_id)
  );

  -- Credit creator wallet (create if not exists)
  INSERT INTO public.creator_wallets (creator_id, available_balance, pending_balance, lifetime_earned, currency)
  VALUES (v_creator_id, 0, 0, 0, 'NGN')
  ON CONFLICT (creator_id) DO NOTHING;

  UPDATE public.creator_wallets
  SET
    available_balance = available_balance + v_payment_amount,
    lifetime_earned = lifetime_earned + v_payment_amount,
    updated_at = NOW()
  WHERE creator_id = v_creator_id;

  -- Get creator's new balance for transaction record
  SELECT available_balance INTO v_creator_balance
  FROM public.creator_wallets
  WHERE creator_id = v_creator_id;

  -- Insert creator transaction
  INSERT INTO public.creator_wallet_transactions (
    creator_id, type, amount, balance_after, reference_type, reference_id,
    description, status, processed_at
  ) VALUES (
    v_creator_id, 'sm_panel_payment', v_payment_amount, v_creator_balance,
    'creator_request_invitation', p_invitation_id,
    format('Creator request payment: %s', v_activation.title),
    'completed', NOW()
  );

  -- Update invitation to completed
  UPDATE public.creator_request_invitations
  SET
    status = 'completed',
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_amount', v_payment_amount,
    'creator_id', v_creator_id,
    'creator_new_balance', v_creator_balance
  );
END;
$$;

COMMENT ON FUNCTION public.release_creator_request_payment IS 'Brand approves deliverable - releases payment from locked balance to creator wallet';

-- ============================================================
-- CANCEL INVITATION (Brand)
-- Refunds locked funds if invitation was accepted
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_creator_request_invitation(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_activation RECORD;
  v_workspace_id UUID;
  v_refund_amount NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_locked NUMERIC;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Fetch invitation with activation info
  SELECT cri.*, a.workspace_id, a.title as activation_title
  INTO v_invitation
  FROM public.creator_request_invitations cri
  JOIN public.activations a ON a.id = cri.activation_id
  WHERE cri.id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  v_workspace_id := v_invitation.workspace_id;

  -- Verify caller has workspace access
  IF v_user_id IS NOT NULL AND NOT (
    v_workspace_id = v_user_id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = v_workspace_id
        AND wm.user_id = v_user_id
        AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
        AND wm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'No access to this workspace';
  END IF;

  -- Can't cancel if already completed (paid)
  IF v_invitation.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot cancel - payment already released';
  END IF;

  -- If accepted and locked, refund the funds
  IF v_invitation.status = 'accepted' AND v_invitation.wallet_locked THEN
    v_refund_amount := v_invitation.quoted_rate;

    -- Refund to available balance
    UPDATE public.workspace_wallets
    SET
      balance = balance + v_refund_amount,
      locked_balance = locked_balance - v_refund_amount,
      updated_at = NOW()
    WHERE workspace_id = v_workspace_id;

    -- Get updated balances
    SELECT balance, locked_balance INTO v_new_balance, v_new_locked
    FROM public.workspace_wallets
    WHERE workspace_id = v_workspace_id;

    -- Insert refund transaction
    INSERT INTO public.wallet_transactions (
      workspace_id, type, amount, balance_after, locked_balance_after,
      reference_type, reference_id, description, status, processed_at
    ) VALUES (
      v_workspace_id, 'refund', v_refund_amount, v_new_balance, v_new_locked,
      'creator_request_invitation', p_invitation_id,
      format('Refund for cancelled creator request invitation: %s', v_invitation.activation_title),
      'completed', NOW()
    );

    -- Update activation spent_amount
    UPDATE public.activations
    SET
      spent_amount = GREATEST(0, COALESCE(spent_amount, 0) - v_refund_amount),
      updated_at = NOW()
    WHERE id = v_invitation.activation_id;
  END IF;

  -- Update invitation status
  UPDATE public.creator_request_invitations
  SET
    status = 'cancelled',
    wallet_locked = false,
    updated_at = NOW()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded', v_refund_amount > 0,
    'refund_amount', v_refund_amount
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_creator_request_invitation IS 'Brand cancels invitation - refunds locked funds if applicable';

-- ============================================================
-- MARK INVITATION FULFILLED (Creator)
-- Called when creator submits their deliverable
-- ============================================================

CREATE OR REPLACE FUNCTION public.fulfill_creator_request_invitation(
  p_invitation_id UUID,
  p_submission_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_invitation RECORD;
BEGIN
  -- Get the creator_id for the current user
  SELECT id INTO v_creator_id
  FROM public.creators
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Creator profile not found for current user';
  END IF;

  -- Fetch and verify invitation
  SELECT * INTO v_invitation
  FROM public.creator_request_invitations
  WHERE id = p_invitation_id
    AND creator_id = v_creator_id
    AND status = 'accepted';

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found, not yours, or not in accepted state';
  END IF;

  -- Update invitation with fulfillment info
  UPDATE public.creator_request_invitations
  SET
    fulfilled_at = NOW(),
    submission_id = p_submission_id,
    updated_at = NOW()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', p_invitation_id,
    'fulfilled_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.fulfill_creator_request_invitation IS 'Creator marks invitation as fulfilled (deliverable submitted)';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.accept_creator_request_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_creator_request_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_creator_request_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_creator_request_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_creator_request_invitation TO authenticated;
