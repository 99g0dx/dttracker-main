-- Migration: Create workspace_subscriptions table
-- Description: Stores subscription state for each workspace

CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE, -- One subscription per workspace (workspace_id = user_id for personal workspaces)
  plan_slug TEXT NOT NULL DEFAULT 'starter_monthly' REFERENCES billing_plans(slug),

  -- Subscription status
  -- Values: 'trialing', 'active', 'past_due', 'canceled', 'expired'
  status TEXT NOT NULL DEFAULT 'trialing',

  -- Trial tracking
  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  trial_used BOOLEAN DEFAULT false, -- Ensures one trial per workspace

  -- Billing period
  current_period_start_at TIMESTAMPTZ,
  current_period_end_at TIMESTAMPTZ,

  -- Cancellation handling
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,

  -- Failed payment / grace period handling
  past_due_since TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ, -- 3 days after past_due_since

  -- Seat management
  total_seats INTEGER DEFAULT 1,
  extra_seats INTEGER DEFAULT 0,

  -- Paystack references (NO card data stored!)
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  paystack_plan_code TEXT,
  paystack_authorization_code TEXT, -- For recurring charges only

  -- Payment tracking
  last_payment_reference TEXT,
  last_payment_at TIMESTAMPTZ,
  last_payment_amount INTEGER, -- Amount in cents

  -- Billing contact
  billing_email TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ws_sub_workspace ON workspace_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_sub_status ON workspace_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_ws_sub_plan ON workspace_subscriptions(plan_slug);
CREATE INDEX IF NOT EXISTS idx_ws_sub_trial_end ON workspace_subscriptions(trial_end_at) WHERE status = 'trialing';
CREATE INDEX IF NOT EXISTS idx_ws_sub_period_end ON workspace_subscriptions(current_period_end_at);
CREATE INDEX IF NOT EXISTS idx_ws_sub_grace_ends ON workspace_subscriptions(grace_ends_at) WHERE status = 'past_due';
CREATE INDEX IF NOT EXISTS idx_ws_sub_paystack_customer ON workspace_subscriptions(paystack_customer_code);

-- Enable RLS
ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own workspace subscription
CREATE POLICY "Users can view own workspace subscription"
  ON workspace_subscriptions FOR SELECT
  USING (workspace_id = auth.uid());

-- Only service role can insert/update/delete (via Edge Functions)
-- Note: Edge Functions use service role key which bypasses RLS

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS workspace_subscription_updated_at ON workspace_subscriptions;
CREATE TRIGGER workspace_subscription_updated_at
  BEFORE UPDATE ON workspace_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_subscription_timestamp();

-- Function to create default subscription for new users
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

-- Trigger to create subscription when user profile is created
DROP TRIGGER IF EXISTS on_profile_created_create_subscription ON profiles;
CREATE TRIGGER on_profile_created_create_subscription
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();
