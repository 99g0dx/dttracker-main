-- Migration: Create creator_request_invitations table
-- Tracks individual creator invitations for creator_request activations
-- Funds are locked when creator ACCEPTS the invitation (not when sent)

CREATE TABLE IF NOT EXISTS public.creator_request_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL REFERENCES public.activations(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,

  -- Rate/pricing
  quoted_rate NUMERIC NOT NULL CHECK (quoted_rate > 0),
  currency TEXT DEFAULT 'NGN',

  -- Status lifecycle: pending -> accepted/declined/expired -> completed/cancelled
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Invitation sent, awaiting creator response
    'accepted',     -- Creator accepted, funds locked
    'declined',     -- Creator declined
    'expired',      -- Invitation expired (deadline passed)
    'completed',    -- Creator fulfilled, payment released
    'cancelled'     -- Brand cancelled before completion
  )),

  -- Wallet tracking (populated when creator accepts)
  wallet_locked BOOLEAN DEFAULT false,
  wallet_transaction_id UUID,  -- Reference to wallet_transactions.id when locked

  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,           -- When creator accepted/declined
  fulfilled_at TIMESTAMPTZ,           -- When creator submitted deliverable
  paid_at TIMESTAMPTZ,                -- When payment was released

  -- Submission tracking (when creator fulfills)
  submission_id UUID REFERENCES public.activation_submissions(id) ON DELETE SET NULL,

  -- Notes and requirements
  brand_notes TEXT,                   -- Brand's notes/requirements for this creator
  creator_notes TEXT,                 -- Creator's response notes
  deliverable_description TEXT,       -- What the creator needs to deliver

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each creator can only be invited once per activation
  UNIQUE(activation_id, creator_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_creator_request_invitations_activation
  ON public.creator_request_invitations(activation_id);
CREATE INDEX IF NOT EXISTS idx_creator_request_invitations_creator
  ON public.creator_request_invitations(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_request_invitations_status
  ON public.creator_request_invitations(status);
CREATE INDEX IF NOT EXISTS idx_creator_request_invitations_pending
  ON public.creator_request_invitations(creator_id, status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.creator_request_invitations ENABLE ROW LEVEL SECURITY;

-- RLS: Workspace members can view invitations for their activations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_request_invitations' AND policyname = 'workspace_members_can_view_invitations') THEN
    CREATE POLICY workspace_members_can_view_invitations
      ON public.creator_request_invitations FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.activations a
          JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
          WHERE a.id = creator_request_invitations.activation_id
            AND wm.user_id = auth.uid()
            AND wm.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM public.activations a
          WHERE a.id = creator_request_invitations.activation_id
            AND a.workspace_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS: Workspace editors can insert/update invitations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_request_invitations' AND policyname = 'workspace_editors_can_manage_invitations') THEN
    CREATE POLICY workspace_editors_can_manage_invitations
      ON public.creator_request_invitations FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.activations a
          JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
          WHERE a.id = creator_request_invitations.activation_id
            AND wm.user_id = auth.uid()
            AND wm.status = 'active'
            AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
        )
        OR EXISTS (
          SELECT 1 FROM public.activations a
          WHERE a.id = creator_request_invitations.activation_id
            AND a.workspace_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.activations a
          JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
          WHERE a.id = creator_request_invitations.activation_id
            AND wm.user_id = auth.uid()
            AND wm.status = 'active'
            AND wm.role IN ('brand_owner', 'agency_admin', 'brand_member', 'agency_ops')
        )
        OR EXISTS (
          SELECT 1 FROM public.activations a
          WHERE a.id = creator_request_invitations.activation_id
            AND a.workspace_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS: Creators can view their own invitations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_request_invitations' AND policyname = 'creators_can_view_own_invitations') THEN
    CREATE POLICY creators_can_view_own_invitations
      ON public.creator_request_invitations FOR SELECT
      USING (
        creator_id IN (
          SELECT c.id FROM public.creators c WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_creator_request_invitation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_creator_request_invitation_updated_at
  ON public.creator_request_invitations;

CREATE TRIGGER trigger_update_creator_request_invitation_updated_at
  BEFORE UPDATE ON public.creator_request_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_creator_request_invitation_updated_at();

COMMENT ON TABLE public.creator_request_invitations IS 'Tracks individual creator invitations for creator_request activations. Funds lock when creator accepts.';
