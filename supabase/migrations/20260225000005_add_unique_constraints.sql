-- Add unique constraint on dobble_tap_submission_id for webhook upserts
ALTER TABLE activation_submissions
  ADD CONSTRAINT unique_dobble_tap_submission_id
  UNIQUE (dobble_tap_submission_id);

-- Add unique constraint on dobble_tap_campaign_id for activation lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_activations_dobble_tap_campaign_id_unique
  ON activations(dobble_tap_campaign_id)
  WHERE dobble_tap_campaign_id IS NOT NULL;

-- Add comment
COMMENT ON CONSTRAINT unique_dobble_tap_submission_id ON activation_submissions
  IS 'Ensures one-to-one mapping between DTTracker and Dobbletap submissions for webhook upserts';
