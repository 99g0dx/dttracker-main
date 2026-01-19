-- Migration: Create billing_plans table
-- Description: Stores subscription plan definitions with pricing and feature limits

CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'starter', 'pro', 'agency'
  name TEXT NOT NULL,
  description TEXT,
  price_amount INTEGER NOT NULL DEFAULT 0, -- in USD cents (4900 = $49)
  currency TEXT DEFAULT 'USD',
  interval TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
  paystack_plan_code TEXT, -- Paystack plan code if using their subscription system
  features_json JSONB DEFAULT '{}', -- Feature flags for this plan
  limits_json JSONB DEFAULT '{}', -- Resource limits {campaigns: 2, creators_per_campaign: 5}
  display_order INTEGER DEFAULT 0, -- For sorting in UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_billing_plans_slug ON billing_plans(slug);
CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON billing_plans(is_active) WHERE is_active = true;

-- Seed initial plans
INSERT INTO billing_plans (slug, name, description, price_amount, currency, features_json, limits_json, display_order) VALUES
(
  'starter',
  'Starter',
  'Perfect for independent artists and emerging managers',
  0, -- Free
  'USD',
  '{
    "basic_analytics": true,
    "manual_post_tracking": true,
    "email_support": true,
    "csv_export": true
  }',
  '{
    "campaigns": 2,
    "creators_per_campaign": 5,
    "team_members": 1
  }',
  1
),
(
  'pro',
  'Pro',
  'Built for artist managers and small labels',
  4900, -- $49
  'USD',
  '{
    "basic_analytics": true,
    "advanced_analytics": true,
    "automated_scraping": true,
    "multi_platform": true,
    "real_time_tracking": true,
    "custom_reports": true,
    "priority_support": true,
    "api_access": true,
    "team_collaboration": true,
    "unlimited_data_retention": true
  }',
  '{
    "campaigns": -1,
    "creators_per_campaign": -1,
    "team_members": 5
  }',
  2
),
(
  'agency',
  'Agency',
  'For agencies and labels managing multiple clients',
  0, -- Custom pricing (contact sales)
  'USD',
  '{
    "basic_analytics": true,
    "advanced_analytics": true,
    "automated_scraping": true,
    "multi_platform": true,
    "real_time_tracking": true,
    "custom_reports": true,
    "priority_support": true,
    "api_access": true,
    "team_collaboration": true,
    "unlimited_data_retention": true,
    "white_label_reports": true,
    "dedicated_account_manager": true,
    "custom_integrations": true,
    "sla_guarantees": true
  }',
  '{
    "campaigns": -1,
    "creators_per_campaign": -1,
    "team_members": -1
  }',
  3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_amount = EXCLUDED.price_amount,
  features_json = EXCLUDED.features_json,
  limits_json = EXCLUDED.limits_json,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Enable RLS
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans (public pricing page)
CREATE POLICY "Anyone can view active plans"
  ON billing_plans FOR SELECT
  USING (is_active = true);
