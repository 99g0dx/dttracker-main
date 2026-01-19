-- Migration: Create billing_events table
-- Description: Audit log for all billing-related events (webhooks, state changes)

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID, -- Can be null for events not yet linked to a workspace

  -- Event identification
  event_source TEXT NOT NULL, -- 'paystack', 'system', 'user'
  event_type TEXT NOT NULL, -- 'charge.success', 'subscription.create', 'trial.started', etc.

  -- Paystack-specific (for deduplication)
  paystack_event_id TEXT, -- Paystack's unique event ID
  reference TEXT, -- Transaction reference

  -- Event data
  payload JSONB, -- Full webhook payload or event details

  -- Processing status
  processed_at TIMESTAMPTZ, -- When we processed this event
  processing_error TEXT, -- Error message if processing failed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index for Paystack event deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_paystack_dedup
  ON billing_events(paystack_event_id)
  WHERE paystack_event_id IS NOT NULL;

-- Index for finding events by reference (transaction lookup)
CREATE INDEX IF NOT EXISTS idx_billing_events_reference
  ON billing_events(reference)
  WHERE reference IS NOT NULL;

-- Index for workspace event history
CREATE INDEX IF NOT EXISTS idx_billing_events_workspace
  ON billing_events(workspace_id, created_at DESC)
  WHERE workspace_id IS NOT NULL;

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_billing_events_type
  ON billing_events(event_type, created_at DESC);

-- Index for unprocessed events (for retry logic)
CREATE INDEX IF NOT EXISTS idx_billing_events_unprocessed
  ON billing_events(created_at)
  WHERE processed_at IS NULL;

-- Enable RLS
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own billing events
CREATE POLICY "Users can view own billing events"
  ON billing_events FOR SELECT
  USING (workspace_id = auth.uid());

-- Only service role can insert/update (via Edge Functions)
-- Edge Functions use service role key which bypasses RLS


-- Helper view for recent billing activity
CREATE OR REPLACE VIEW billing_activity AS
SELECT
  be.id,
  be.workspace_id,
  be.event_source,
  be.event_type,
  be.reference,
  be.created_at,
  be.processed_at,
  CASE
    WHEN be.event_type = 'charge.success' THEN 'Payment successful'
    WHEN be.event_type = 'charge.failed' THEN 'Payment failed'
    WHEN be.event_type = 'subscription.create' THEN 'Subscription created'
    WHEN be.event_type = 'subscription.disable' THEN 'Subscription canceled'
    WHEN be.event_type = 'trial.started' THEN 'Trial started'
    WHEN be.event_type = 'trial.ended' THEN 'Trial ended'
    WHEN be.event_type = 'plan.changed' THEN 'Plan changed'
    ELSE be.event_type
  END as event_description,
  be.payload->>'amount' as amount,
  be.payload->>'currency' as currency
FROM billing_events be
ORDER BY be.created_at DESC;
