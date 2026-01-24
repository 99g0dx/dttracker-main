-- Migration: Create plan_catalog table
-- Description: New unified plan catalog for 4-tier seat-based billing

-- Create the new plan_catalog table
CREATE TABLE IF NOT EXISTS plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan identification
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro', 'agency')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'none')),
  slug TEXT UNIQUE NOT NULL, -- e.g., 'free', 'starter_monthly', 'pro_yearly'
  name TEXT NOT NULL,
  description TEXT,

  -- Pricing (in USD cents)
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  included_seats INTEGER NOT NULL DEFAULT 1,
  extra_seat_price_cents INTEGER DEFAULT 0,
  max_seats INTEGER DEFAULT NULL, -- NULL = unlimited

  -- Paystack plan codes (two-subscription model)
  paystack_base_plan_code TEXT, -- Base subscription plan
  paystack_seat_plan_code TEXT, -- Per-seat add-on plan

  -- Limits as JSONB
  -- Structure: {
  --   campaigns: number (-1 = unlimited),
  --   creators_per_campaign: number,
  --   platforms: string[],
  --   scrape_interval_minutes: number,
  --   retention_days: number (-1 = unlimited)
  -- }
  limits_json JSONB NOT NULL DEFAULT '{}',

  -- Features as JSONB
  -- Structure: { feature_name: boolean }
  features_json JSONB NOT NULL DEFAULT '{}',

  -- Display options
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint on tier + billing_cycle combination
  UNIQUE(tier, billing_cycle)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plan_catalog_tier ON plan_catalog(tier);
CREATE INDEX IF NOT EXISTS idx_plan_catalog_slug ON plan_catalog(slug);
CREATE INDEX IF NOT EXISTS idx_plan_catalog_active ON plan_catalog(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plan_catalog_display ON plan_catalog(display_order);

-- Enable RLS
ALTER TABLE plan_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans (public pricing page)
CREATE POLICY "Anyone can view active plans"
  ON plan_catalog FOR SELECT
  USING (is_active = true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_plan_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS plan_catalog_updated_at ON plan_catalog;
CREATE TRIGGER plan_catalog_updated_at
  BEFORE UPDATE ON plan_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_catalog_timestamp();
