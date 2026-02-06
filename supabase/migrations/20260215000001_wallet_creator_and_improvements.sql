-- Migration: Wallet creator system and optional improvements
-- Adds creator_wallets, creator_wallet_transactions, creator_withdrawal_requests;
-- extends release_sm_panel_payment to credit creator wallet and set paid_at;
-- optional: cancelled_by/cancelled_at, wallet_alerts extension, backfill, views,
-- reconcile_workspace_wallet (JSON), billing_events status, comments.

-- ============================================
-- 1. CREATOR WALLETS
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_wallets (
  creator_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance NUMERIC NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earned NUMERIC NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  currency TEXT DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.creator_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_wallets(creator_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'sm_panel_payment',
    'contest_prize',
    'bonus',
    'withdrawal',
    'withdrawal_reversal',
    'adjustment'
  )),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_creator_wallet_transactions_creator
  ON public.creator_wallet_transactions(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_wallet_transactions_reference
  ON public.creator_wallet_transactions(reference_type, reference_id);

-- ============================================
-- 2. CREATOR WITHDRAWAL REQUESTS (creator-initiated)
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  )),
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_reference TEXT,
  payment_provider TEXT,
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_withdrawal_requests_creator
  ON public.creator_withdrawal_requests(creator_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_withdrawal_requests_status
  ON public.creator_withdrawal_requests(status, created_at DESC);

-- ============================================
-- 3. RLS FOR CREATOR TABLES
-- ============================================

ALTER TABLE public.creator_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_wallets_own_select
  ON public.creator_wallets FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY creator_wallet_transactions_own_select
  ON public.creator_wallet_transactions FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY creator_withdrawal_requests_own_select
  ON public.creator_withdrawal_requests FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY creator_withdrawal_requests_own_insert
  ON public.creator_withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Service role / backend will INSERT into creator_wallets and creator_wallet_transactions via SECURITY DEFINER RPCs

-- ============================================
-- 4. EXTEND release_sm_panel_payment (credit creator wallet, set paid_at)
-- ============================================

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
BEGIN
  v_user_id := auth.uid();

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

-- ============================================
-- 5. OPTIONAL: activations cancelled_by / cancelled_at
-- ============================================

ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- ============================================
-- 6. UPDATE cancel_sm_panel_activation TO SET cancelled_by / cancelled_at
-- ============================================

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

    SELECT balance, locked_balance INTO v_new_balance, v_new_locked
    FROM public.workspace_wallets
    WHERE workspace_id = v_workspace_id;

    INSERT INTO public.wallet_transactions (
      workspace_id, type, amount, balance_after, locked_balance_after,
      reference_type, reference_id, description, status, processed_at
    ) VALUES (
      v_workspace_id, 'refund', v_remaining, v_new_balance, v_new_locked,
      'activation', p_activation_id, 'SM panel cancelled – budget refunded',
      'completed', NOW()
    );
  END IF;

  UPDATE public.activations
  SET status = 'cancelled', cancelled_by = v_user_id, cancelled_at = NOW(), updated_at = NOW()
  WHERE id = p_activation_id;
END;
$$;

-- ============================================
-- 7. OPTIONAL: wallet_alerts – extra types and notify columns
-- ============================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'wallet_alerts' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%alert_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.wallet_alerts DROP CONSTRAINT %I', r.conname);
    EXIT;
  END LOOP;
END $$;

ALTER TABLE public.wallet_alerts
  ADD CONSTRAINT wallet_alerts_alert_type_check
  CHECK (alert_type IN ('low_balance', 'large_spend', 'negative_balance', 'daily_limit_reached'));

ALTER TABLE public.wallet_alerts
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_slack BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_in_app BOOLEAN DEFAULT true;

-- Allow threshold to be NULL for alert types that do not use it (e.g. daily_limit_reached)
ALTER TABLE public.wallet_alerts
  ALTER COLUMN threshold DROP NOT NULL;

-- ============================================
-- 8. OPTIONAL: chronological backfill for balance_after / locked_balance_after
-- ============================================

CREATE OR REPLACE FUNCTION public.backfill_wallet_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace RECORD;
  v_tx RECORD;
  v_running_balance NUMERIC;
  v_running_locked NUMERIC;
BEGIN
  FOR v_workspace IN
    SELECT DISTINCT workspace_id
    FROM public.wallet_transactions
    ORDER BY workspace_id
  LOOP
    v_running_balance := 0;
    v_running_locked := 0;

    FOR v_tx IN
      SELECT id, type, amount, created_at
      FROM public.wallet_transactions
      WHERE workspace_id = v_workspace.workspace_id
      ORDER BY created_at ASC, id ASC
    LOOP
      CASE v_tx.type
        WHEN 'fund' THEN
          v_running_balance := v_running_balance + v_tx.amount;
        WHEN 'lock' THEN
          v_running_balance := v_running_balance - v_tx.amount;
          v_running_locked := v_running_locked + v_tx.amount;
        WHEN 'unlock' THEN
          v_running_locked := v_running_locked - v_tx.amount;
        WHEN 'refund' THEN
          v_running_locked := v_running_locked - v_tx.amount;
          v_running_balance := v_running_balance + v_tx.amount;
        WHEN 'payout' THEN
          v_running_balance := v_running_balance - v_tx.amount;
        WHEN 'fee' THEN
          v_running_balance := v_running_balance - v_tx.amount;
        WHEN 'withdrawal' THEN
          v_running_balance := v_running_balance - v_tx.amount;
        ELSE
          CONTINUE;
      END CASE;

      UPDATE public.wallet_transactions
      SET balance_after = v_running_balance, locked_balance_after = v_running_locked
      WHERE id = v_tx.id;
    END LOOP;
  END LOOP;
END;
$$;

SELECT public.backfill_wallet_balances();

DROP FUNCTION public.backfill_wallet_balances();

-- Set NOT NULL only where no NULLs remain (backfill populated all)
DO $$
BEGIN
  UPDATE public.wallet_transactions SET balance_after = 0 WHERE balance_after IS NULL;
  UPDATE public.wallet_transactions SET locked_balance_after = 0 WHERE locked_balance_after IS NULL;
  ALTER TABLE public.wallet_transactions ALTER COLUMN balance_after SET NOT NULL;
  ALTER TABLE public.wallet_transactions ALTER COLUMN locked_balance_after SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipping NOT NULL on balance_after/locked_balance_after: %', SQLERRM;
END $$;

-- ============================================
-- 9. UNIQUE (workspace_id, reconciliation_date) ON wallet_reconciliations
-- ============================================

-- Remove duplicates before creating unique index (keep the most recent one)
DO $$
BEGIN
  DELETE FROM public.wallet_reconciliations wr1
  USING public.wallet_reconciliations wr2
  WHERE wr1.id < wr2.id
    AND wr1.workspace_id = wr2.workspace_id
    AND wr1.reconciliation_date = wr2.reconciliation_date;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_reconciliations_workspace_date
  ON public.wallet_reconciliations(workspace_id, reconciliation_date);

-- ============================================
-- 10. VIEWS: wallet_summary, recent_wallet_transactions
-- ============================================

CREATE OR REPLACE VIEW public.wallet_summary AS
SELECT
  w.workspace_id,
  w.balance AS available_balance,
  w.locked_balance,
  w.pending_balance,
  w.lifetime_spent,
  w.currency,
  w.daily_spend_limit,
  w.daily_spent_today,
  COUNT(DISTINCT a.id) AS active_activations,
  COALESCE(SUM(a.total_budget - a.spent_amount), 0) AS total_locked_breakdown
FROM public.workspace_wallets w
LEFT JOIN public.activations a ON a.workspace_id = w.workspace_id AND a.status = 'live'
GROUP BY w.workspace_id, w.balance, w.locked_balance, w.pending_balance,
  w.lifetime_spent, w.currency, w.daily_spend_limit, w.daily_spent_today;

CREATE OR REPLACE VIEW public.recent_wallet_transactions AS
SELECT
  wt.*,
  ws.name AS workspace_name,
  a.title AS activation_title
FROM public.wallet_transactions wt
JOIN public.workspaces ws ON ws.id = wt.workspace_id
LEFT JOIN public.activations a ON a.id = wt.reference_id
  AND wt.reference_type IN ('activation', 'creator_activation')
ORDER BY wt.created_at DESC
LIMIT 100;

-- ============================================
-- 11. reconcile_workspace_wallet (date + JSON) – keep reconcile_wallet as-is
-- ============================================

CREATE OR REPLACE FUNCTION public.reconcile_workspace_wallet(
  p_workspace_id UUID,
  p_reconciliation_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_expected_balance NUMERIC := 0;
  v_expected_locked NUMERIC := 0;
  v_actual_balance NUMERIC;
  v_actual_locked NUMERIC;
  v_tx_count INTEGER := 0;
  v_total_funds NUMERIC := 0;
  v_total_locks NUMERIC := 0;
  v_total_unlocks NUMERIC := 0;
  v_total_refunds NUMERIC := 0;
  v_total_payouts NUMERIC := 0;
  v_status TEXT;
  r RECORD;
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

  FOR r IN
    SELECT type, amount
    FROM public.wallet_transactions
    WHERE workspace_id = p_workspace_id
      AND (status = 'completed' OR status IS NULL)
      AND DATE(created_at) <= p_reconciliation_date
  LOOP
    v_tx_count := v_tx_count + 1;
    CASE r.type
      WHEN 'fund' THEN v_expected_balance := v_expected_balance + r.amount; v_total_funds := v_total_funds + r.amount;
      WHEN 'lock' THEN v_expected_balance := v_expected_balance - r.amount; v_expected_locked := v_expected_locked + r.amount; v_total_locks := v_total_locks + r.amount;
      WHEN 'unlock' THEN v_expected_locked := v_expected_locked - r.amount; v_total_unlocks := v_total_unlocks + r.amount;
      WHEN 'refund' THEN v_expected_balance := v_expected_balance + r.amount; v_expected_locked := v_expected_locked - r.amount; v_total_refunds := v_total_refunds + r.amount;
      WHEN 'payout' THEN v_expected_balance := v_expected_balance - r.amount; v_total_payouts := v_total_payouts + r.amount;
      WHEN 'fee' THEN v_expected_balance := v_expected_balance - r.amount; v_total_payouts := v_total_payouts + r.amount;
      WHEN 'withdrawal' THEN v_expected_balance := v_expected_balance - r.amount; v_total_payouts := v_total_payouts + r.amount;
      ELSE NULL;
    END CASE;
  END LOOP;

  SELECT balance, locked_balance INTO v_actual_balance, v_actual_locked
  FROM public.workspace_wallets
  WHERE workspace_id = p_workspace_id;

  v_actual_balance := COALESCE(v_actual_balance, 0);
  v_actual_locked := COALESCE(v_actual_locked, 0);

  IF (v_actual_balance - v_expected_balance) != 0 OR (v_actual_locked - v_expected_locked) != 0 THEN
    v_status := 'discrepancy_found';
  ELSE
    v_status := 'reconciled';
  END IF;

  INSERT INTO public.wallet_reconciliations (
    workspace_id, reconciliation_date, expected_balance, actual_balance,
    expected_locked, actual_locked, transaction_count, total_funds, total_locks,
    total_unlocks, total_refunds, total_payouts, status, created_by
  ) VALUES (
    p_workspace_id, p_reconciliation_date, v_expected_balance, v_actual_balance,
    v_expected_locked, v_actual_locked, v_tx_count, v_total_funds, v_total_locks,
    v_total_unlocks, v_total_refunds, v_total_payouts, v_status, v_user_id
  )
  ON CONFLICT (workspace_id, reconciliation_date)
  DO UPDATE SET
    expected_balance = EXCLUDED.expected_balance,
    actual_balance = EXCLUDED.actual_balance,
    expected_locked = EXCLUDED.expected_locked,
    actual_locked = EXCLUDED.actual_locked,
    transaction_count = EXCLUDED.transaction_count,
    total_funds = EXCLUDED.total_funds,
    total_locks = EXCLUDED.total_locks,
    total_unlocks = EXCLUDED.total_unlocks,
    total_refunds = EXCLUDED.total_refunds,
    total_payouts = EXCLUDED.total_payouts,
    status = EXCLUDED.status;

  RETURN json_build_object(
    'workspace_id', p_workspace_id,
    'reconciliation_date', p_reconciliation_date,
    'expected_balance', v_expected_balance,
    'actual_balance', v_actual_balance,
    'balance_discrepancy', v_actual_balance - v_expected_balance,
    'expected_locked', v_expected_locked,
    'actual_locked', v_actual_locked,
    'locked_discrepancy', v_actual_locked - v_expected_locked,
    'status', v_status
  );
END;
$$;

-- ============================================
-- 12. billing_events: status column and optional index
-- ============================================

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

CREATE INDEX IF NOT EXISTS idx_billing_events_reference_paystack
  ON public.billing_events(reference)
  WHERE event_source = 'paystack';

-- ============================================
-- 13. COMMENTS
-- ============================================

COMMENT ON TABLE public.creator_wallets IS 'Creator earning wallets (per auth user)';
COMMENT ON TABLE public.creator_wallet_transactions IS 'Creator wallet transaction history';
COMMENT ON TABLE public.creator_withdrawal_requests IS 'Creator-initiated withdrawal requests from creator wallet';
COMMENT ON COLUMN public.wallet_transactions.balance_after IS 'Available balance snapshot after this transaction';
COMMENT ON COLUMN public.wallet_transactions.locked_balance_after IS 'Locked balance snapshot after this transaction';
COMMENT ON COLUMN public.activations.cancelled_by IS 'User who cancelled the activation';
COMMENT ON COLUMN public.activations.cancelled_at IS 'When the activation was cancelled';
