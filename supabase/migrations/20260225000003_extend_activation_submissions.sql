-- Extend activation_submissions table with fields needed for Dobbletap webhooks

-- Add columns for post submission webhook
ALTER TABLE activation_submissions
  ADD COLUMN IF NOT EXISTS post_url TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'facebook', 'other'));

-- Add columns for submission webhook
ALTER TABLE activation_submissions
  ADD COLUMN IF NOT EXISTS submitted_note TEXT,
  ADD COLUMN IF NOT EXISTS asset_url TEXT,
  ADD COLUMN IF NOT EXISTS asset_version INTEGER DEFAULT 1;

-- Add columns for review decision webhook
ALTER TABLE activation_submissions
  ADD COLUMN IF NOT EXISTS review_decision TEXT CHECK (review_decision IN ('approved', 'rejected', 'approved_with_notes')),
  ADD COLUMN IF NOT EXISTS review_feedback TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_type TEXT CHECK (reviewer_type IN ('agency', 'brand', 'admin')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dobble_tap_review_id UUID;

-- Add columns for campaign completed webhook
ALTER TABLE activation_submissions
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_currency TEXT DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS completion_status TEXT CHECK (completion_status IN ('completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_activation_submissions_post_url ON activation_submissions(post_url);
CREATE INDEX IF NOT EXISTS idx_activation_submissions_platform ON activation_submissions(platform);
CREATE INDEX IF NOT EXISTS idx_activation_submissions_review_decision ON activation_submissions(review_decision);
CREATE INDEX IF NOT EXISTS idx_activation_submissions_reviewed_at ON activation_submissions(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_activation_submissions_payment_reference ON activation_submissions(payment_reference);

-- Add comments
COMMENT ON COLUMN activation_submissions.post_url IS 'Public URL where content was posted (from post_submitted webhook)';
COMMENT ON COLUMN activation_submissions.platform IS 'Social media platform where content was posted';
COMMENT ON COLUMN activation_submissions.submitted_note IS 'Note from creator with submission';
COMMENT ON COLUMN activation_submissions.asset_url IS 'URL to uploaded asset/content file';
COMMENT ON COLUMN activation_submissions.asset_version IS 'Version number for content resubmissions';
COMMENT ON COLUMN activation_submissions.review_decision IS 'Review decision from Dobbletap (approved/rejected)';
COMMENT ON COLUMN activation_submissions.review_feedback IS 'Feedback from reviewer';
COMMENT ON COLUMN activation_submissions.reviewer_type IS 'Type of reviewer (agency/brand/admin)';
COMMENT ON COLUMN activation_submissions.payment_reference IS 'Payment gateway reference (e.g., Paystack transaction ID)';
COMMENT ON COLUMN activation_submissions.completion_status IS 'Campaign completion status';
