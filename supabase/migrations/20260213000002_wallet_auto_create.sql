-- Auto-create wallet when workspace is created
-- Previously wallets were only created via payment webhook or one-time backfill

CREATE OR REPLACE FUNCTION public.create_default_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.workspaces (id, name, owner_user_id)
  VALUES (NEW.id, 'Workspace', NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'brand_owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO public.usage_counters (workspace_id)
  VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;

  INSERT INTO public.subscriptions (
    workspace_id,
    tier,
    billing_cycle,
    status,
    included_seats,
    extra_seats,
    total_seats,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'pro',
    'monthly',
    'trialing',
    2,
    0,
    2,
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  ON CONFLICT DO NOTHING;

  -- Auto-create wallet for new workspace
  INSERT INTO public.workspace_wallets (workspace_id, balance, locked_balance, currency)
  VALUES (NEW.id, 0, 0, 'NGN')
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: create wallets for workspaces that don't have one
INSERT INTO public.workspace_wallets (workspace_id, balance, locked_balance, currency)
SELECT w.id, 0, 0, 'NGN'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_wallets ww WHERE ww.workspace_id = w.id
);
