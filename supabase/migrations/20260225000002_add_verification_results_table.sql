-- Create verification_results table for storing verification outcomes
CREATE TABLE IF NOT EXISTS verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES activation_submissions(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('contest_entry', 'sm_panel')),
  status TEXT NOT NULL CHECK (status IN ('verified', 'failed', 'pending')),
  results JSONB NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  dobble_tap_verification_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_verification_results_submission ON verification_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_verification_results_type ON verification_results(verification_type);
CREATE INDEX IF NOT EXISTS idx_verification_results_status ON verification_results(status);
CREATE INDEX IF NOT EXISTS idx_verification_results_verified_at ON verification_results(verified_at);

-- Add comment
COMMENT ON TABLE verification_results IS 'Stores verification results for contest entries and SM panel tasks from Dobbletap';
