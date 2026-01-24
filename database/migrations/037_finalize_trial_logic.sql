-- Migration: Finalize trial logic and migrate data
-- Description: Updates default subscription trigger, fixes FKs, and migrates legacy free users

-- 0. Ensure columns exist (Fix for "column does not exist" error)
DO $$
BEGIN
  -- Add total_seats if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspace_subscriptions' AND column_name = 'total_seats'
  ) THEN
    ALTER TABLE workspace_subscriptions ADD COLUMN total_seats INTEGER DEFAULT 1;
  END IF;

  -- Add extra_seats if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspace_subscriptions' AND column_name = 'extra_seats'
  ) THEN
    ALTER TABLE workspace_subscriptions ADD COLUMN extra_seats INTEGER DEFAULT 0;
  END IF;
END $$;

-- 1. Update the trigger function to ensure it uses 'pro_monthly' and sets seats
-- (This overrides the old function from 026 if it was already applied)
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_subscriptions (
    workspace_id,
    plan_slug,
    status,
    trial_start_at,
    trial_end_at,
    trial_used,
    total_seats
  )
  VALUES (NEW.id, 'pro_monthly', 'trialing', now(), now() + interval '14 days', true, 2)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Migrate existing 'free' or 'starter' (legacy default) subscriptions to Pro Trial
-- This ensures everyone is on the new system.
-- We give them a fresh 14-day trial to be generous during the migration.
UPDATE workspace_subscriptions
SET 
  plan_slug = 'pro_monthly',
  status = 'trialing',
  trial_start_at = now(),
  trial_end_at = now() + interval '14 days',
  total_seats = 2,
  trial_used = true
WHERE 
  plan_slug = 'free' 
  OR status = 'free'
  OR (plan_slug = 'starter' AND status = 'trialing');

-- 3. Ensure total_seats is set for everyone (fix NULLs from before 036)
UPDATE workspace_subscriptions
SET total_seats = 2
WHERE total_seats IS NULL AND plan_slug LIKE 'pro%';

UPDATE workspace_subscriptions
SET total_seats = 1
WHERE total_seats IS NULL AND plan_slug LIKE 'starter%';

UPDATE workspace_subscriptions
SET total_seats = 3
WHERE total_seats IS NULL AND plan_slug LIKE 'agency%';

-- 4. Fix Foreign Key to point to plan_catalog (if not already)
DO $$
BEGIN
  -- Try to drop constraint referencing billing_plans if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'workspace_subscriptions_plan_slug_fkey'
    AND table_name = 'workspace_subscriptions'
  ) THEN
    ALTER TABLE workspace_subscriptions DROP CONSTRAINT workspace_subscriptions_plan_slug_fkey;
  END IF;

  -- Add new constraint to plan_catalog
  ALTER TABLE workspace_subscriptions 
  ADD CONSTRAINT workspace_subscriptions_plan_slug_fkey 
  FOREIGN KEY (plan_slug) REFERENCES plan_catalog(slug);
END $$;