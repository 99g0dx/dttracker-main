-- Migration: Create workspace_wallets and wallet_transactions for activation budgets
-- Workspace wallets hold balance for funding activations (contests, SM panels)

-- workspace_wallets: one per workspace
CREATE TABLE IF NOT EXISTS public.workspace_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked_balance NUMERIC NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  currency TEXT DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK to workspaces (workspaces table created in earlier migrations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workspace_wallets_workspace_id_fkey') THEN
    ALTER TABLE public.workspace_wallets
      ADD CONSTRAINT workspace_wallets_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- wallet_transactions: audit log
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fund', 'lock', 'unlock', 'payout', 'refund')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_workspace ON public.wallet_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON public.wallet_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.workspace_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can view
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_wallets' AND policyname = 'workspace_members_can_view_wallets') THEN
    CREATE POLICY workspace_members_can_view_wallets
      ON public.workspace_wallets FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = workspace_wallets.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND policyname = 'workspace_members_can_view_transactions') THEN
    CREATE POLICY workspace_members_can_view_transactions
      ON public.wallet_transactions FOR SELECT
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = wallet_transactions.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        )
      );
  END IF;
END $$;

-- RLS: owners/admins can fund (insert + update wallet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_wallets' AND policyname = 'workspace_admins_can_manage_wallets') THEN
    CREATE POLICY workspace_admins_can_manage_wallets
      ON public.workspace_wallets FOR ALL
      USING (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          JOIN public.workspaces w ON w.id = wm.workspace_id
          WHERE wm.workspace_id = workspace_wallets.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
          AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
        )
      )
      WITH CHECK (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          JOIN public.workspaces w ON w.id = wm.workspace_id
          WHERE wm.workspace_id = workspace_wallets.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
          AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- Insert transactions: service role or workspace admins (via Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND policyname = 'workspace_admins_can_insert_transactions') THEN
    CREATE POLICY workspace_admins_can_insert_transactions
      ON public.wallet_transactions FOR INSERT
      WITH CHECK (
        workspace_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          JOIN public.workspaces w ON w.id = wm.workspace_id
          WHERE wm.workspace_id = wallet_transactions.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
          AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- Backfill: create wallet for each workspace (skip if workspaces table has different structure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
    INSERT INTO public.workspace_wallets (workspace_id, balance, locked_balance, currency)
    SELECT w.id, 0, 0, 'NGN'
    FROM public.workspaces w
    WHERE NOT EXISTS (SELECT 1 FROM public.workspace_wallets ww WHERE ww.workspace_id = w.id);
  END IF;
END $$;
