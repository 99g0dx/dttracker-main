-- Migration: Seed plan_catalog with 4-tier plans
-- Description: Insert all 6 plan configurations (3 tiers x 2 billing cycles)

-- Clear existing plans if re-running
DELETE FROM plan_catalog WHERE true;

-- Insert plans with locked pricing
INSERT INTO plan_catalog (
  tier,
  billing_cycle,
  slug,
  name,
  description,
  base_price_cents,
  included_seats,
  extra_seat_price_cents,
  max_seats,
  limits_json,
  features_json,
  display_order,
  is_popular
) VALUES

-- Starter Monthly
(
  'starter',
  'monthly',
  'starter_monthly',
  'Starter',
  'For independent artists and emerging managers',
  1900, -- $19
  1,
  500, -- $5/extra seat
  5,
  '{
    "campaigns": 3,
    "creators_per_campaign": 25,
    "platforms": ["tiktok", "instagram"],
    "scrape_interval_minutes": 720,
    "retention_days": 180
  }',
  '{
    "basic_analytics": true,
    "data_export": true,
    "email_support": true
  }',
  2,
  false
),

-- Starter Yearly (20% discount: $19 * 12 * 0.8 = $182.40 -> $182)
(
  'starter',
  'yearly',
  'starter_yearly',
  'Starter',
  'For independent artists and emerging managers',
  18200, -- $182
  1,
  4800, -- $48/extra seat yearly ($5 * 12 * 0.8)
  5,
  '{
    "campaigns": 3,
    "creators_per_campaign": 25,
    "platforms": ["tiktok", "instagram"],
    "scrape_interval_minutes": 720,
    "retention_days": 180
  }',
  '{
    "basic_analytics": true,
    "data_export": true,
    "email_support": true
  }',
  2,
  false
),

-- Pro Monthly
(
  'pro',
  'monthly',
  'pro_monthly',
  'Pro',
  'Built for artist managers and small labels',
  4900, -- $49
  2, -- 2 included seats
  900, -- $9/extra seat
  25, -- Max 25 seats
  '{
    "campaigns": 10,
    "creators_per_campaign": 100,
    "platforms": ["tiktok", "instagram", "youtube", "twitter", "spotify"],
    "scrape_interval_minutes": 240,
    "retention_days": -1
  }',
  '{
    "basic_analytics": true,
    "advanced_analytics": true,
    "data_export": true,
    "api_access": true,
    "team_collaboration": true,
    "automated_scraping": true,
    "custom_reports": true,
    "priority_support": true
  }',
  3,
  true -- Most popular
),

-- Pro Yearly (20% discount: $49 * 12 * 0.8 = $470.40 -> $470)
(
  'pro',
  'yearly',
  'pro_yearly',
  'Pro',
  'Built for artist managers and small labels',
  47000, -- $470
  2, -- 2 included seats
  8600, -- $86/extra seat yearly ($9 * 12 * 0.8 = $86.4)
  25,
  '{
    "campaigns": 10,
    "creators_per_campaign": 100,
    "platforms": ["tiktok", "instagram", "youtube", "twitter", "spotify"],
    "scrape_interval_minutes": 240,
    "retention_days": -1
  }',
  '{
    "basic_analytics": true,
    "advanced_analytics": true,
    "data_export": true,
    "api_access": true,
    "team_collaboration": true,
    "automated_scraping": true,
    "custom_reports": true,
    "priority_support": true
  }',
  3,
  true
),

-- Agency Monthly
(
  'agency',
  'monthly',
  'agency_monthly',
  'Agency',
  'For agencies and labels managing multiple clients',
  12900, -- $129
  3, -- 3 included seats
  700, -- $7/extra seat
  NULL, -- Unlimited seats
  '{
    "campaigns": -1,
    "creators_per_campaign": -1,
    "platforms": ["tiktok", "instagram", "youtube", "twitter", "spotify"],
    "scrape_interval_minutes": 30,
    "retention_days": -1
  }',
  '{
    "basic_analytics": true,
    "advanced_analytics": true,
    "data_export": true,
    "api_access": true,
    "team_collaboration": true,
    "automated_scraping": true,
    "custom_reports": true,
    "priority_support": true,
    "white_label": true,
    "dedicated_account_manager": true
  }',
  4,
  false
),

-- Agency Yearly (20% discount: $129 * 12 * 0.8 = $1238.40 -> $1238)
(
  'agency',
  'yearly',
  'agency_yearly',
  'Agency',
  'For agencies and labels managing multiple clients',
  123800, -- $1238
  3, -- 3 included seats
  6700, -- $67/extra seat yearly ($7 * 12 * 0.8 = $67.2)
  NULL, -- Unlimited seats
  '{
    "campaigns": -1,
    "creators_per_campaign": -1,
    "platforms": ["tiktok", "instagram", "youtube", "twitter", "spotify"],
    "scrape_interval_minutes": 30,
    "retention_days": -1
  }',
  '{
    "basic_analytics": true,
    "advanced_analytics": true,
    "data_export": true,
    "api_access": true,
    "team_collaboration": true,
    "automated_scraping": true,
    "custom_reports": true,
    "priority_support": true,
    "white_label": true,
    "dedicated_account_manager": true
  }',
  4,
  false
);
