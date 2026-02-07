-- Extend activations table for Dobbletap webhook integration

-- Add column for Dobbletap campaign ID mapping
ALTER TABLE activations
  ADD COLUMN IF NOT EXISTS dobble_tap_campaign_id TEXT;

-- Add column for status history tracking
ALTER TABLE activations
  ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Create index for Dobbletap campaign ID lookup
CREATE INDEX IF NOT EXISTS idx_activations_dobble_tap_campaign_id ON activations(dobble_tap_campaign_id);

-- Add comments
COMMENT ON COLUMN activations.dobble_tap_campaign_id IS 'Campaign ID in Dobbletap system for cross-reference';
COMMENT ON COLUMN activations.status_history IS 'Array of status change events from Dobbletap status_changed webhook';

-- Helper function to append to JSONB array (if not exists)
CREATE OR REPLACE FUNCTION jsonb_array_append(arr JSONB, elem JSONB)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(arr, '[]'::jsonb) || elem
$$;

COMMENT ON FUNCTION jsonb_array_append IS 'Appends an element to a JSONB array, handles null arrays';
