-- Migration: Update creator request invitation acceptance to include service fee
-- Applies 10% service fee when creators accept invitations

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
  v_service_fee NUMERIC;
  v_total_cost NUMERIC;
  v_available_balance NUMERIC;
  v_new_balance NUMERIC;
  v_new_locked NUMERIC;
  v_tx_id UUID;
  v_service_fee_tx_id UUID;
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
  
  -- Calculate service fee (10% of quoted rate)
  v_service_fee := ROUND(v_quoted_rate * 0.10, 2);
  v_total_cost := v_quoted_rate + v_service_fee;

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

  -- Check workspace wallet has sufficient balance for total cost
  SELECT balance INTO v_available_balance
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  IF v_available_balance IS NULL THEN
    RAISE EXCEPTION 'Workspace wallet not found';
  END IF;

  IF v_available_balance < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, Required: % (Rate: % + Service Fee: %)',
      v_available_balance, v_total_cost, v_quoted_rate, v_service_fee;
  END IF;

  -- Lock funds from workspace wallet (atomically) - deduct total cost
  UPDATE public.workspace_wallets
  SET
    balance = balance - v_total_cost,
    locked_balance = locked_balance + v_quoted_rate,
    updated_at = NOW()
  WHERE workspace_id = v_workspace_id
    AND balance >= v_total_cost;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to lock funds (race condition or insufficient balance)';
  END IF;

  -- Get updated balances for transaction record
  SELECT balance, locked_balance INTO v_new_balance, v_new_locked
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  -- Insert wallet transaction record for creator payment lock
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

  -- Insert wallet transaction record for service fee
  INSERT INTO public.wallet_transactions (
    workspace_id,
    type,
    amount,
    service_fee_amount,
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
    'service_fee',
    v_service_fee,
    v_service_fee,
    v_new_balance,
    v_new_locked,
    'creator_request_invitation',
    p_invitation_id,
    format('Service fee (10%%) for creator request: %s', v_activation.title),
    'completed',
    NOW(),
    jsonb_build_object(
      'activation_id', v_invitation.activation_id,
      'creator_id', v_creator_id,
      'quoted_rate', v_quoted_rate,
      'service_fee_rate', 0.10,
      'base_amount', v_quoted_rate
    )
  )
  RETURNING id INTO v_service_fee_tx_id;

  -- Update invitation status to accepted
  UPDATE public.creator_request_invitations
  SET
    status = 'accepted',
    wallet_locked = true,
    wallet_transaction_id = v_tx_id,
    responded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invitation_id;

  -- Update activation spent_amount to track committed funds (including service fee)
  UPDATE public.activations
  SET
    spent_amount = COALESCE(spent_amount, 0) + v_total_cost,
    updated_at = NOW()
  WHERE id = v_invitation.activation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', p_invitation_id,
    'locked_amount', v_quoted_rate,
    'service_fee', v_service_fee,
    'total_cost', v_total_cost,
    'activation_title', v_activation.title
  );
END;
$$;

COMMENT ON FUNCTION public.accept_creator_request_invitation IS 'Creator accepts invitation - locks quoted_rate from workspace wallet and applies 10% service fee';
