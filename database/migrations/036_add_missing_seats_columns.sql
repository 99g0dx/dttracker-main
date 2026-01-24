-- Migration: Add missing seat columns to workspace_subscriptions
-- Description: Ensures total_seats and extra_seats columns exist to fix "column does not exist" errors

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