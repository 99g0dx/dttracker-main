-- Fix wallet RLS policy: remove reference to non-existent status column
-- The workspace_members table does not have a 'status' column, causing all RLS checks to fail

-- Fix SELECT policy for workspace_wallets
DROP POLICY IF EXISTS workspace_members_can_view_wallets ON public.workspace_wallets;

CREATE POLICY workspace_members_can_view_wallets
  ON public.workspace_wallets FOR SELECT
  USING (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_wallets.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Fix SELECT policy for wallet_transactions
DROP POLICY IF EXISTS workspace_members_can_view_transactions ON public.wallet_transactions;

CREATE POLICY workspace_members_can_view_transactions
  ON public.wallet_transactions FOR SELECT
  USING (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = wallet_transactions.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Also fix the admin policies that may have the same issue
DROP POLICY IF EXISTS workspace_admins_can_manage_wallets ON public.workspace_wallets;

CREATE POLICY workspace_admins_can_manage_wallets
  ON public.workspace_wallets FOR ALL
  USING (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = workspace_wallets.workspace_id
      AND wm.user_id = auth.uid()
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
      AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS workspace_admins_can_insert_transactions ON public.wallet_transactions;

CREATE POLICY workspace_admins_can_insert_transactions
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (
    workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = wallet_transactions.workspace_id
      AND wm.user_id = auth.uid()
      AND (wm.role IN ('brand_owner', 'agency_admin') OR w.owner_user_id = auth.uid())
    )
  );
