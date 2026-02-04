-- Migration: SM Panel tiered pricing - schema extensions for activations, activation_submissions,
-- creator_social_accounts, and unlock_activation_payment RPC

-- ============================================================
-- 1.1 Activations table
-- ============================================================
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS base_rate NUMERIC DEFAULT 200;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS required_comment_text TEXT;
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS comment_guidelines TEXT;

-- Update task_type: add 'repost', keep 'share' for backward compatibility
ALTER TABLE public.activations DROP CONSTRAINT IF EXISTS activations_task_type_check;
ALTER TABLE public.activations ADD CONSTRAINT activations_task_type_check
  CHECK (task_type IS NULL OR task_type IN ('like', 'share', 'comment', 'story', 'repost'));

CREATE INDEX IF NOT EXISTS idx_active_sm_panels ON public.activations(type, status, task_type)
  WHERE type = 'sm_panel' AND status = 'live';

-- ============================================================
-- 1.2 activation_submissions table
-- ============================================================
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS creator_followers INTEGER;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS proof_comment_text TEXT;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS verification_method TEXT;
ALTER TABLE public.activation_submissions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ============================================================
-- 1.3 creator_social_accounts table (if exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'creator_social_accounts') THEN
    ALTER TABLE public.creator_social_accounts ADD COLUMN IF NOT EXISTS last_follower_sync TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_creator_social_followers ON public.creator_social_accounts(creator_id, platform, followers);
  END IF;
END $$;

-- ============================================================
-- 1.4 unlock_activation_payment RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_activation_payment(
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get activation and workspace
  SELECT a.id, a.workspace_id INTO v_activation_id, v_workspace_id
  FROM public.activation_submissions s
  JOIN public.activations a ON a.id = s.activation_id
  WHERE s.id = p_submission_id;

  IF v_activation_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- Verify user has workspace access (editor or owner)
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

  -- Deduct from locked_balance
  UPDATE public.workspace_wallets
  SET
    locked_balance = locked_balance - p_payment_amount,
    updated_at = NOW()
  WHERE workspace_id = v_workspace_id
    AND locked_balance >= p_payment_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient locked balance or wallet not found';
  END IF;

  SELECT locked_balance INTO v_new_locked
  FROM public.workspace_wallets
  WHERE workspace_id = v_workspace_id;

  -- Log transaction
  INSERT INTO public.wallet_transactions (
    workspace_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    metadata
  ) VALUES (
    v_workspace_id,
    'unlock',
    p_payment_amount,
    v_new_locked,
    'activation_submission',
    p_submission_id,
    jsonb_build_object('activation_id', v_activation_id, 'payment_amount', p_payment_amount)
  );
END;
$$;
