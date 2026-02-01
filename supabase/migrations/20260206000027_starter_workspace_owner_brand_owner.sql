-- Starter plan: ensure workspace owner has brand_owner role (full control)
-- 1) One-time backfill: set role = brand_owner for all Starter workspace owners
-- 2) Trigger: when subscription tier = starter, upsert workspace_members so owner has brand_owner

-- 1a) Backfill: upsert workspace_members so owner has brand_owner for every Starter workspace
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_user_id, 'brand_owner'
FROM public.workspaces w
JOIN public.subscriptions s ON s.workspace_id = w.id
WHERE s.tier = 'starter'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'brand_owner';

-- 1b) Trigger function: when tier = starter, ensure workspace owner has brand_owner
CREATE OR REPLACE FUNCTION public.ensure_starter_workspace_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tier = 'starter' THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    SELECT NEW.workspace_id, w.owner_user_id, 'brand_owner'
    FROM public.workspaces w
    WHERE w.id = NEW.workspace_id
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'brand_owner';
  END IF;
  RETURN NEW;
END;
$$;

-- 1c) Trigger on subscriptions: after insert or update of tier
DROP TRIGGER IF EXISTS ensure_starter_workspace_owner_trigger ON public.subscriptions;
CREATE TRIGGER ensure_starter_workspace_owner_trigger
  AFTER INSERT OR UPDATE OF tier
  ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_starter_workspace_owner();
