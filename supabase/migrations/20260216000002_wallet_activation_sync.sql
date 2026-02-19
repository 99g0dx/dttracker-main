-- Migration: Wallet-Activation Synchronization Improvements
-- Adds validation, enhanced reconciliation, and idempotency checks
-- Date: 2026-02-16

-- ============================================
-- 1. VIEW: Expected wallet state from activations
-- ============================================
CREATE OR REPLACE VIEW public.wallet_activation_sync_state AS
SELECT 
  ww.workspace_id,
  ww.balance AS actual_balance,
  ww.locked_balance AS actual_locked,
  
  -- Expected locked balance = sum of all live activation budgets minus spent
  COALESCE(SUM(
    CASE 
      WHEN a.status IN ('live', 'draft') AND a.type IN ('sm_panel', 'contest')
      THEN COALESCE(a.total_budget, 0) - COALESCE(a.spent_amount, 0)
      ELSE 0
    END
  ), 0) AS expected_locked_from_activations,
  
  -- Total budget locked in activations
  COALESCE(SUM(
    CASE 
      WHEN a.status IN ('live', 'draft') AND a.type IN ('sm_panel', 'contest')
      THEN COALESCE(a.total_budget, 0)
      ELSE 0
    END
  ), 0) AS total_budget_locked,
  
  -- Total spent across activations
  COALESCE(SUM(
    CASE 
      WHEN a.status IN ('live', 'draft') AND a.type IN ('sm_panel', 'contest')
      THEN COALESCE(a.spent_amount, 0)
      ELSE 0
    END
  ), 0) AS total_spent_in_activations,
  
  -- Count of live activations
  COUNT(CASE WHEN a.status = 'live' THEN 1 END) AS live_activation_count,
  
  -- Discrepancy check
  (ww.locked_balance - COALESCE(SUM(
    CASE 
      WHEN a.status IN ('live', 'draft') AND a.type IN ('sm_panel', 'contest')
      THEN COALESCE(a.total_budget, 0) - COALESCE(a.spent_amount, 0)
      ELSE 0
    END
  ), 0)) AS locked_discrepancy
  
FROM public.workspace_wallets ww
LEFT JOIN public.activations a ON a.workspace_id = ww.workspace_id
GROUP BY ww.workspace_id, ww.balance, ww.locked_balance;

COMMENT ON VIEW public.wallet_activation_sync_state IS 
  'Shows expected vs actual wallet state based on activation budgets. Use for reconciliation.';

-- ============================================
-- 2. FUNCTION: Validate wallet-activation sync
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_wallet_activation_sync(
  p_workspace_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sync_state RECORD;
  v_discrepancy NUMERIC;
  v_is_valid BOOLEAN;
  v_details JSON;
BEGIN
  SELECT * INTO v_sync_state
  FROM public.wallet_activation_sync_state
  WHERE workspace_id = p_workspace_id;
  
  IF v_sync_state IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Workspace wallet not found'
    );
  END IF;
  
  v_discrepancy := ABS(COALESCE(v_sync_state.locked_discrepancy, 0));
  v_is_valid := v_discrepancy < 0.01; -- Allow 0.01 NGN tolerance for rounding
  
  v_details := json_build_object(
    'workspace_id', p_workspace_id,
    'actual_locked', v_sync_state.actual_locked,
    'expected_locked', v_sync_state.expected_locked_from_activations,
    'discrepancy', v_sync_state.locked_discrepancy,
    'total_budget_locked', v_sync_state.total_budget_locked,
    'total_spent', v_sync_state.total_spent_in_activations,
    'live_activation_count', v_sync_state.live_activation_count,
    'is_valid', v_is_valid,
    'tolerance', 0.01
  );
  
  RETURN json_build_object(
    'valid', v_is_valid,
    'details', v_details
  );
END;
$$;

COMMENT ON FUNCTION public.validate_wallet_activation_sync IS 
  'Validates that wallet locked_balance matches expected from activations. Returns JSON with validation result.';

-- ============================================
-- 3. ENHANCED RECONCILIATION: Include activation state
-- ============================================
CREATE OR REPLACE FUNCTION public.reconcile_wallet_with_activations(
  p_workspace_id UUID,
  p_reconciliation_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_wallet_reconciliation JSON;
  v_activation_validation JSON;
  v_combined_result JSON;
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
  
  -- Run standard wallet reconciliation
  SELECT public.reconcile_workspace_wallet(p_workspace_id, p_reconciliation_date)
  INTO v_wallet_reconciliation;
  
  -- Validate activation sync
  SELECT public.validate_wallet_activation_sync(p_workspace_id)
  INTO v_activation_validation;
  
  -- Combine results
  v_combined_result := json_build_object(
    'wallet_reconciliation', v_wallet_reconciliation,
    'activation_validation', v_activation_validation,
    'overall_sync_status', CASE 
      WHEN (v_wallet_reconciliation->>'status')::text = 'reconciled' 
        AND (v_activation_validation->>'valid')::boolean = true
      THEN 'synced'
      ELSE 'discrepancy'
    END,
    'reconciliation_date', p_reconciliation_date
  );
  
  RETURN v_combined_result;
END;
$$;

COMMENT ON FUNCTION public.reconcile_wallet_with_activations IS 
  'Enhanced reconciliation that checks both wallet transactions AND activation state. Returns combined sync status.';

-- ============================================
-- 4. TRIGGER: Validate wallet operations
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_wallet_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expected_locked NUMERIC;
  v_discrepancy NUMERIC;
BEGIN
  -- After wallet update, validate locked_balance matches activations
  IF TG_OP = 'UPDATE' AND (OLD.locked_balance IS DISTINCT FROM NEW.locked_balance) THEN
    SELECT COALESCE(SUM(
      CASE 
        WHEN a.status IN ('live', 'draft') AND a.type IN ('sm_panel', 'contest')
        THEN COALESCE(a.total_budget, 0) - COALESCE(a.spent_amount, 0)
        ELSE 0
      END
    ), 0) INTO v_expected_locked
    FROM public.activations a
    WHERE a.workspace_id = NEW.workspace_id;
    
    v_discrepancy := ABS(NEW.locked_balance - v_expected_locked);
    
    -- Log warning if discrepancy > 1 NGN (allow small rounding differences)
    IF v_discrepancy > 1 THEN
      RAISE WARNING 'Wallet locked_balance (%) does not match expected from activations (%) for workspace %',
        NEW.locked_balance, v_expected_locked, NEW.workspace_id;
      
      -- Note: wallet_alerts table structure doesn't support custom messages
      -- The warning is logged via RAISE WARNING for monitoring
      -- For production, consider adding a separate sync_issues table or extending wallet_alerts
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_wallet_operation_trigger'
  ) THEN
    CREATE TRIGGER validate_wallet_operation_trigger
    AFTER UPDATE ON public.workspace_wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_wallet_operation();
  END IF;
END $$;

-- ============================================
-- 5. FUNCTION: Auto-fix minor discrepancies
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_fix_wallet_activation_sync(
  p_workspace_id UUID,
  p_auto_fix_threshold NUMERIC DEFAULT 10.00 -- Only auto-fix if discrepancy < 10 NGN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_validation JSON;
  v_details JSON;
  v_discrepancy NUMERIC;
  v_expected_locked NUMERIC;
  v_actual_locked NUMERIC;
  v_current_balance NUMERIC;
  v_fixed BOOLEAN := false;
  v_fix_amount NUMERIC;
BEGIN
  -- Validate first
  SELECT public.validate_wallet_activation_sync(p_workspace_id) INTO v_validation;
  
  IF (v_validation->>'valid')::boolean THEN
    RETURN json_build_object(
      'fixed', false,
      'reason', 'No discrepancy found',
      'validation', v_validation
    );
  END IF;
  
  v_details := v_validation->'details';
  v_discrepancy := ABS((v_details->>'discrepancy')::numeric);
  v_expected_locked := (v_details->>'expected_locked')::numeric;
  v_actual_locked := (v_details->>'actual_locked')::numeric;
  
  -- Only auto-fix if discrepancy is small
  IF v_discrepancy <= p_auto_fix_threshold THEN
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM public.workspace_wallets
    WHERE workspace_id = p_workspace_id;
    
    -- Determine fix direction and amount
    IF v_actual_locked > v_expected_locked THEN
      -- Too much locked, refund the difference
      v_fix_amount := v_actual_locked - v_expected_locked;
      
      UPDATE public.workspace_wallets
      SET 
        locked_balance = v_expected_locked,
        balance = balance + v_fix_amount,
        updated_at = NOW()
      WHERE workspace_id = p_workspace_id;
      
      -- Log the fix as refund
      INSERT INTO public.wallet_transactions (
        workspace_id,
        type,
        amount,
        balance_after,
        locked_balance_after,
        reference_type,
        description,
        status,
        processed_at,
        metadata
      ) VALUES (
        p_workspace_id,
        'refund',
        v_fix_amount,
        v_current_balance + v_fix_amount,
        v_expected_locked,
        'system',
        format('Auto-fix: corrected locked balance discrepancy of %', v_discrepancy),
        'completed',
        NOW(),
        jsonb_build_object(
          'auto_fix', true,
          'previous_locked', v_actual_locked,
          'corrected_locked', v_expected_locked,
          'discrepancy', v_discrepancy
        )
      );
    ELSIF v_actual_locked < v_expected_locked THEN
      -- Too little locked, lock more (if balance allows)
      v_fix_amount := v_expected_locked - v_actual_locked;
      
      IF v_current_balance >= v_fix_amount THEN
        UPDATE public.workspace_wallets
        SET 
          locked_balance = v_expected_locked,
          balance = balance - v_fix_amount,
          updated_at = NOW()
        WHERE workspace_id = p_workspace_id;
        
        -- Log the fix as lock
        INSERT INTO public.wallet_transactions (
          workspace_id,
          type,
          amount,
          balance_after,
          locked_balance_after,
          reference_type,
          description,
          status,
          processed_at,
          metadata
        ) VALUES (
          p_workspace_id,
          'lock',
          v_fix_amount,
          v_current_balance - v_fix_amount,
          v_expected_locked,
          'system',
          format('Auto-fix: corrected locked balance discrepancy of %', v_discrepancy),
          'completed',
          NOW(),
          jsonb_build_object(
            'auto_fix', true,
            'previous_locked', v_actual_locked,
            'corrected_locked', v_expected_locked,
            'discrepancy', v_discrepancy
          )
        );
      ELSE
        -- Insufficient balance to fix
        RETURN json_build_object(
          'fixed', false,
          'reason', format('Insufficient balance to fix. Need %, have %', v_fix_amount, v_current_balance),
          'discrepancy', v_discrepancy,
          'validation', v_validation
        );
      END IF;
    END IF;
    
    v_fixed := true;
  END IF;
  
  RETURN json_build_object(
    'fixed', v_fixed,
    'discrepancy', v_discrepancy,
    'threshold', p_auto_fix_threshold,
    'validation', v_validation
  );
END;
$$;

COMMENT ON FUNCTION public.auto_fix_wallet_activation_sync IS 
  'Automatically fixes small discrepancies between wallet and activation state. Only fixes if discrepancy < threshold.';

-- ============================================
-- 6. INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_activations_workspace_status 
  ON public.activations(workspace_id, status) 
  WHERE status IN ('live', 'draft');

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference 
  ON public.wallet_transactions(reference_type, reference_id, type, status);

-- ============================================
-- 7. ENHANCE release_sm_panel_payment with idempotency
-- ============================================
-- Note: This modifies the existing function to add idempotency check
-- We'll add the check at the beginning of the function

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
  v_creator_id UUID;
  v_paid_at TIMESTAMPTZ;
  v_user_id UUID;
  v_new_locked NUMERIC;
  v_balance_after NUMERIC;
  v_daily_limit NUMERIC;
  v_spent_today NUMERIC;
  v_reset_date DATE;
  v_creator_balance NUMERIC;
  v_existing_tx_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if already processed (idempotency)
  SELECT id INTO v_existing_tx_id
  FROM public.wallet_transactions
  WHERE reference_type = 'creator_activation'
    AND reference_id = p_submission_id
    AND type = 'unlock'
    AND status = 'completed'
  LIMIT 1;
  
  IF v_existing_tx_id IS NOT NULL THEN
    RAISE NOTICE 'Payment already released for submission %', p_submission_id;
    RETURN; -- Idempotent: already processed
  END IF;
  
  SELECT a.id, a.workspace_id, s.creator_id, s.paid_at
  INTO v_activation_id, v_workspace_id, v_creator_id, v_paid_at
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
  
  -- Credit creator wallet and set paid_at when creator_id is set and not yet paid
  IF v_creator_id IS NOT NULL AND v_paid_at IS NULL THEN
    INSERT INTO public.creator_wallets (creator_id, available_balance, pending_balance, lifetime_earned, currency)
    VALUES (v_creator_id, 0, 0, 0, 'NGN')
    ON CONFLICT (creator_id) DO NOTHING;
    
    UPDATE public.creator_wallets
    SET
      available_balance = available_balance + p_payment_amount,
      lifetime_earned = lifetime_earned + p_payment_amount,
      updated_at = NOW()
    WHERE creator_id = v_creator_id;
    
    SELECT available_balance INTO v_creator_balance
    FROM public.creator_wallets
    WHERE creator_id = v_creator_id;
    
    INSERT INTO public.creator_wallet_transactions (
      creator_id,
      type,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description,
      status,
      processed_at
    ) VALUES (
      v_creator_id,
      'sm_panel_payment',
      p_payment_amount,
      v_creator_balance,
      'activation_submission',
      p_submission_id,
      'SM panel task payment',
      'completed',
      NOW()
    );
    
    UPDATE public.activation_submissions
    SET paid_at = NOW()
    WHERE id = p_submission_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.release_sm_panel_payment IS 
  'Releases payment for SM panel activation submission. Includes idempotency check to prevent duplicate processing.';
